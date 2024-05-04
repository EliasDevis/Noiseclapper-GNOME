// ------------------------- Imports ----------------------------
// External
import St from 'gi://St';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {
	gettext as _,
	ngettext,
	pgettext,
} from 'resource:///org/gnome/shell/extensions/extension.js';
// Internal
import type NoiseclapperExtension from './extension.js';
import {
	LogType,
	logIfEnabled,
	noiseCancellingSignalList,
	equalizerPresetSignalList,
} from './common.js';

// ----------------------- Indicator -----------------------
export default GObject.registerClass(
	class NoiseclapperIndicator extends PanelMenu.Button {
		private readonly extension: NoiseclapperExtension;

		constructor(extension: NoiseclapperExtension) {
			logIfEnabled(LogType.Debug, 'Initializing Noiseclapper indicator...');

			super(0, extension.uuid);
			this.extension = extension;

			const box = new St.BoxLayout({
				vertical: false,
				styleClass: 'panel-status-menu-box',
			});
			const icon = new St.Icon({
				iconName: 'audio-headphones-symbolic',
				styleClass: 'system-status-icon',
			});
			box.add_child(icon);
			this.add_child(box);

			// The 2 submenus
			const noiseCancellingModeMenu = new PopupMenu.PopupSubMenuMenuItem(
				_('Noise Cancelling Mode'),
			);
			this.menu.addMenuItem(noiseCancellingModeMenu);
			const equalizerPresetMenu = new PopupMenu.PopupSubMenuMenuItem(
				_('Equalizer Preset'),
			);
			this.menu.addMenuItem(equalizerPresetMenu);

			// The submenus' mode/preset lists
			const noiseCancellingModeButtonList = [
				{
					label: '🚋 ' + _('Transport'),
					signal: noiseCancellingSignalList.transport,
				},
				{label: '🏠 ' + _('Indoor'), signal: noiseCancellingSignalList.indoor},
				{
					label: '🌳 ' + _('Outdoor'),
					signal: noiseCancellingSignalList.outdoor,
				},
				// { label: '🔇 '+_('Default'), signal: noiseCancellingSignalList.default }, //Not really necessary, probably better to keep it as a comment.
				{
					label: '🚫 ' + _('Normal / No ANC'),
					signal: noiseCancellingSignalList.normal,
				},
				{
					label: '🪟 ' + _('Transparency / No NC'),
					signal: noiseCancellingSignalList.transparency,
				},
			];
			this.addAllInListAsButtons(
				noiseCancellingModeButtonList,
				noiseCancellingModeMenu,
			);
			const equalizerPresetButtonList = [
				{
					label: '🎵 ' + _('Soundcore Signature'),
					signal: equalizerPresetSignalList.signature,
				},
				{
					label: '🎸 ' + _('Acoustic'),
					signal: equalizerPresetSignalList.acoustic,
				},
				{
					label: '🎸 ' + _('Bass Booster'),
					signal: equalizerPresetSignalList.bassBooster,
				},
				{
					label: '🚫 ' + _('Bass Reducer'),
					signal: equalizerPresetSignalList.bassReducer,
				},
				{
					label: '🎻 ' + _('Classical'),
					signal: equalizerPresetSignalList.classical,
				},
				{
					label: '🎤 ' + _('Podcast'),
					signal: equalizerPresetSignalList.podcast,
				},
				{label: '🪩 ' + _('Dance'), signal: equalizerPresetSignalList.dance},
				{label: '🖴' + _('Deep'), signal: equalizerPresetSignalList.deep},
				{
					label: '⚡ ' + _('Electronic'),
					signal: equalizerPresetSignalList.electronic,
				},
				{label: '🚫 ' + _('Flat'), signal: equalizerPresetSignalList.flat},
				{label: '🎹 ' + _('Hip-Hop'), signal: equalizerPresetSignalList.hipHop},
				{label: '🎷 ' + _('Jazz'), signal: equalizerPresetSignalList.jazz},
				{label: '💃🏽 ' + _('Latin'), signal: equalizerPresetSignalList.latin},
				{label: '🍸 ' + _('Lounge'), signal: equalizerPresetSignalList.lounge},
				{label: '🎹 ' + _('Piano'), signal: equalizerPresetSignalList.piano},
				{label: '🎸 ' + _('Pop'), signal: equalizerPresetSignalList.pop},
				{label: '🎹 ' + _('RnB'), signal: equalizerPresetSignalList.rnB},
				{label: '🎸 ' + _('Rock'), signal: equalizerPresetSignalList.rock},
				{
					label: '🔉 ' + _('Small Speaker(s)'),
					signal: equalizerPresetSignalList.smallSpeakers,
				},
				{
					label: '👄 ' + _('Spoken Word'),
					signal: equalizerPresetSignalList.spokenWord,
				},
				{
					label: '🎼 ' + _('Treble Booster'),
					signal: equalizerPresetSignalList.trebleBooster,
				},
				{
					label: '🚫 ' + _('Treble Reducer'),
					signal: equalizerPresetSignalList.trebleReducer,
				},
			];
			this.addAllInListAsButtons(
				equalizerPresetButtonList,
				equalizerPresetMenu,
			);

			// Separator
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			// Settings button
			const settingsButton = new PopupMenu.PopupMenuItem(_('Settings'));
			settingsButton.connect('activate', () => {
				this.extension.openPreferences();
			});
			this.menu.addMenuItem(settingsButton);
		}

		addAllInListAsButtons(
			List: Array<{label: string; signal: string}>,
			Submenu: PopupMenu.PopupSubMenuMenuItem,
		) {
			for (const element of List) {
				const button = new PopupMenu.PopupMenuItem(element.label);
				button.connect('activate', () => {
					this.extension.signalHandler(element.signal);
				});
				Submenu.menu.addMenuItem(button);
			}
		}

		// Lots of ugly bypasses, will have to fix later.
		applyPosition() {
			const boxes: {0: unknown; 1: unknown; 2: unknown} = {
				// @ts-expect-error _leftBox not in types
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/naming-convention
				0: Main.panel._leftBox,
				// @ts-expect-error _centerBox not in types
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/naming-convention
				1: Main.panel._centerBox,
				// @ts-expect-error _rightBox not in types
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/naming-convention
				2: Main.panel._rightBox,
			};
			const position = this.extension.settings.get_int('position');
			const index = this.extension.settings.get_int('position-number');

			Main.panel._addToPanelBox(
				this.extension.uuid,
				this,
				index,
				// @ts-expect-error TypeScript doesn't like the workaround I'm using.
				boxes[position],
			);
		}

		destroy(): void {
			// Apparently, this also destroys children without me having to do it myself.
			super.destroy();
		}
	},
);
