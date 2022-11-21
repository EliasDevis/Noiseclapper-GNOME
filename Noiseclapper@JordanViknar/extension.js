//----------------------------Variables------------------------------
let PYTHON_TYPE;
let DEBUG_TERMINAL;
let POSITION;
let POSITION_NUMBER;
let LOGGING;
let NoiseclapperBluetoothClient = null

//------------------------------Libraries----------------------------
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Format = imports.format;
const GnomeBluetooth = imports.gi.GnomeBluetooth;

//Used for translations
const Gettext = imports.gettext.domain("Noiseclapper");
const _ = Gettext.gettext;

//---------------------Extension Initialization---------------------
function init () {
	String.prototype.format = Format.format;

	//Initiate translations
	ExtensionUtils.initTranslations("Noiseclapper");
}

//APIs
const API_NOISE_REDUCTION=Me.dir.get_path()+"/soundcore-life-api/AnkerSoundcoreAPI.py -AmbientSound"
const API_EQUALIZER=Me.dir.get_path()+"/soundcore-life-api/AnkerSoundcoreAPI.py -EQPresets"
//Supported Devices
const SupportedDeviceNames = [
	"Soundcore Life Q35",		//Not tested
	"Soundcore Life Q30",
	"Soundcore Life Q20+",		//Not tested
	"Soundcore Life Q20",		//Not tested
	"Soundcore Life Q10",		//Not tested, only partially compatible
	"BES_BLE" //Buggy name sometimes applied to the Q30
]

//------------------------Indicator Setup---------------------------
const NoiseclapperIndicator = GObject.registerClass({},
class NoiseclapperIndicator extends PanelMenu.Button {
	_init () {
		super._init(0);

		//This will add a box object to the panel. It's basically the extension's button.
		let box = new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box' });

		//We create a GTK symbolic icon in the panel
		this.icon = new St.Icon({ icon_name: 'audio-headphones-symbolic',
			style_class: 'system-status-icon' });
		box.add_actor(this.icon);

		//The 2 submenus
		this.NoiseCancellingModeMenu = new PopupMenu.PopupSubMenuMenuItem(_('Noise Cancelling Mode'));
		this.menu.addMenuItem(this.NoiseCancellingModeMenu);
		this.EqualizerPresetMenu = new PopupMenu.PopupSubMenuMenuItem(_('Equalizer Preset'));
		this.menu.addMenuItem(this.EqualizerPresetMenu);

		//The submenus' mode/preset lists
		let NoiseCancellingModeList = [
			{ label: _('🚋 Transport'), command: 'ANCTransport' },
			{ label: _('🏠 Indoor'), command: 'ANCIndoor' },
			{ label: _('🌳 Outdoor'), command: 'ANCOutdoor' },
			//{ label: _('🔇 Default'), command: 'ANC'}, //Not really necessary, probably better to keep it as a comment.
			{ label: _('🚫 Normal / No ANC'), command: 'Normal' },
			{ label: _('🪟 Transparency / No NC'), command: 'Transparency' },
		];
		this.addAllInListAsButtons(NoiseCancellingModeList, this.NoiseCancellingModeMenu, API_NOISE_REDUCTION);

		let EqualizerPresetList = [
			{ label: _('🎵 Soundcore Signature'), command: 'SoundCore Signature' },
			{ label: _('🎸 Acoustic'), command: 'Acoustic' },
			{ label: _('🎸 Bass Booster'), command: 'Base Booster' },
			{ label: _('🚫 Bass Reducer'), command: 'Base Reducer' },
			{ label: _('🎻 Classical'), command: 'Classical' },
			{ label: _('🎤 Podcast'), command: 'Podcast' },
			{ label: _('🪩 Dance'), command: 'Dance' },
			{ label: _('🖴 Deep'), command: 'Deep' },
			{ label: _('⚡ Electronic'), command: 'Electronic' },
			{ label: _('🚫 Flat'), command: 'Flat' },
			{ label: _('🎹 Hip-Hop'), command: 'Hip-hop' },
			{ label: _('🎷 Jazz'), command: 'Jazz' },
			{ label: _('💃🏽 Latin'), command: 'Latin' },
			{ label: _('🍸 Lounge'), command: 'Lounge' },
			{ label: _('🎹 Piano'), command: 'Piano' },
			{ label: _('🎸 Pop'), command: 'Pop' },
			{ label: _('🎹 RnB'), command: 'R+B' },
			{ label: _('🎸 Rock'), command: 'Rock' },
			{ label: _('🔉 Small Speaker(s)'), command: 'Small Speakers' },
			{ label: _('👄 Spoken Word'), command: 'Spoken Word' },
			{ label: _('🎼 Treble Booster'), command: 'Treble Booster' },
			{ label: _('🚫 Treble Reducer'), command: 'Treble Reducer' },
		]
		this.addAllInListAsButtons(EqualizerPresetList, this.EqualizerPresetMenu, API_EQUALIZER);

		//Separation
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		//Add settings button
		this.settingsButton = new PopupMenu.PopupMenuItem(_('Settings'));
		this.settingsButton.connect('activate', () => {
			this.openSettings();
		})
		this.menu.addMenuItem(this.settingsButton);

		//We add the box to the panel
		this.add_child(box);

		//We apply the settings.
		this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.noiseclapper');
		this._settings.connect('changed', this.applyNewPosition.bind(this));
		this._settingsChangedId = this._settings.connect('changed', this.applySettings.bind(this));
		this.applySettings();

		//Logs that startup was successful.
		if (LOGGING == true) {
			console.log("[Noiseclapper] Startup successful.");
		}
	}

	//Allows turning our lists of modes/presets into actual buttons
	addAllInListAsButtons (List, Submenu, APItoUse) {
		for (let i = 0; i < List.length; i++) {
			//Creates the button
			this.Button = new PopupMenu.PopupMenuItem(List[i].label);

			//Adds it to its respective submenu
			Submenu.menu.box.add(this.Button);
			
			//Binds button to command
			this.Button.connect('activate', () => {
				this.runCommand(APItoUse+' "'+List[i].command+'"')
			})
		}
	}

	runCommand (command) {
		//Detect connected Bluetooth devices using GnomeBluetooth, and extract MAC address of first Soundcore device
		let deviceObject
		try{
			if(LOGGING == true){
				console.log("[Noiseclapper] Obtaining connected devices...");
			}
			deviceObject = NoiseclapperBluetoothClient.get_devices();
		} catch (error) {
			Main.notifyError(_('Noiseclapper failed to obtain Bluetooth devices ('+ error.message +').'));
			if (LOGGING == true) {
				console.log("[Noiseclapper] Error: Could not get Bluetooth devices : " + error);
			}
			return;
		}

		//Convert object into array
		let numberOfDevices = deviceObject.get_n_items()
		let devices = []
		for (let i = 0; i < numberOfDevices; i++) {
			devices.push(deviceObject.get_item(i))
		}
		
		let hasFoundAtLeastOneDevice = false;
		for (let i = 0; i < devices.length; i++) {
			//For every compatible device, run the command
			if (devices[i].connected && devices[i].paired && SupportedDeviceNames.includes(devices[i].name)) {
				//We found a compatible device.
				hasFoundAtLeastOneDevice = true;
				if (LOGGING == true){
					console.log("[Noiseclapper] Found Soundcore device with MAC address "+devices[i].address);
				}

				//We generate the command.
				command = PYTHON_TYPE+" "+command+" "+devices[i].address
				
				if (DEBUG_TERMINAL == true && GLib.file_test('/usr/bin/kgx', GLib.FileTest.EXISTS)){
					//We prioritize GNOME Console if it's installed.
					command = "kgx -- /bin/sh -c '"+command+" ; echo Done - Press enter to exit ; read _'"
				} else if (DEBUG_TERMINAL == true && GLib.file_test('/usr/bin/gnome-terminal', GLib.FileTest.EXISTS)) {
					//Fallback to GNOME Terminal
					command = "gnome-terminal -- /bin/sh -c '"+command+" ; echo Done - Press enter to exit; read _'"
				} else {
					//We run it in background.
					command = "/bin/sh -c '"+command+"'";
				}

				//Logging to the journal
				if (LOGGING == true) {
					console.log("[Noiseclapper] Running : "+command);
				}

				//Actually runs the command
				Util.spawnCommandLine(command);
			}
		}

		//If we DID find devices, but none were compatible.
		if (hasFoundAtLeastOneDevice == false) {
			Main.notifyError(_("Noiseclapper couldn't find a connected compatible device."));
			if (LOGGING == true) {
				console.log("[Noiseclapper] Error : No compatible devices found.");
			}
		}
	}

	openSettings () {
		ExtensionUtils.openPrefs();
	}

	applySettings(){
		POSITION = this._settings.get_int('position');
		POSITION_NUMBER = this._settings.get_int('position-number');

		DEBUG_TERMINAL = this._settings.get_boolean('terminal-enabled');
		if (this._settings.get_int('python-type') == 0) {
			PYTHON_TYPE = "python3";
		} else {
			PYTHON_TYPE = "python";
		}
		LOGGING = this._settings.get_boolean('logging-enabled');
		
		if (LOGGING == true) {
			console.log("[Noiseclapper] Settings applied.");
		}
	}

	applyNewPosition(){
		this.container.get_parent().remove_actor(this.container);
		let boxes = {
			0: Main.panel._leftBox,
			1: Main.panel._centerBox,
			2: Main.panel._rightBox
		};
		let p = this._settings.get_int('position');
		let i = this._settings.get_int('position-number');
		boxes[p].insert_child_at_index(this.container, i);
	}

	//Allows the extension to be disabled.
	_destroy () {
		super._destroy();
	}
});

//-----------------------Enabling Extension-------------------------
let noiseclapperindicator;
function enable() {
	if (LOGGING == true) {
		console.log("[Noiseclapper] Noiseclapper is enabled. Spawning indicator...");
	}

	//We enable the bluetooth client
	NoiseclapperBluetoothClient = new GnomeBluetooth.Client();

	//Creates the indicator
	noiseclapperindicator = new NoiseclapperIndicator();
	//Adds it to the panel
	Main.panel.addToStatusArea('NoiseclapperIndicator', noiseclapperindicator);
	//Sets position
	noiseclapperindicator.applyNewPosition()
}

//------------------------Disabling Extension------------------------
function disable() {
	//Disable Bluetooth client if enabled
	if (NoiseclapperBluetoothClient != null) {
		NoiseclapperBluetoothClient = null;
	}

	//Removes the indicator
	noiseclapperindicator.destroy();
	noiseclapperindicator = null;
}