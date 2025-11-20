/* partaudio.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */


import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gvc from 'gi://Gvc';
import St from 'gi://St';


import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

import * as PartBase from "./partbase.js";


let [SHELL_MAJOR, _] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

/**
 * A clutter constraint that enforces allocation on pixel grid.
 *
 * This is added to resolve issue that buttons are placed on sub-pixel position.
 */
const PixelConstraint = GObject.registerClass(
class PixelConstraint extends Clutter.Constraint {
    /**
     * @override
     * @param {Clutter.Actor} _actor
     * @param {Clutter.ActorBox} allocation
     */
    vfunc_update_allocation(_actor, allocation) {
        allocation.x1 = Math.ceil(allocation.x1);
        allocation.y1 = Math.ceil(allocation.y1);
        allocation.x2 = Math.floor(allocation.x2);
        allocation.y2 = Math.floor(allocation.y2);
    }
});


/**
 * Icon Label Button that used in screen shot UI.
 *
 * Copied from gnome-shell.
 *
 * Modified to ...
 *
 * - To work with various version of St, with slightly different API.
 * - Use #Gio.Icon instead of icon name, to use our own icon.
 */
const IconLabelButton = GObject.registerClass(
class IconLabelButton extends St.Button {
    _init(icon, label, params) {
        super._init(params);

        // Option per version
        let containerProps = {
            style_class: 'icon-label-button-container'
        };

        if (48 <= SHELL_MAJOR) { /* 48 ~ 49 */
            containerProps.orientation = Clutter.Orientation.VERTICAL;
        } else { /* 46 ~ 47 */
            containerProps.vertical = true;
        }

        this._container = new St.BoxLayout(containerProps);
        this.set_child(this._container);

        this._container.add_child(new St.Icon({gicon: icon}));
        this._container.add_child(new St.Label({
            text: label,
            x_align: Clutter.ActorAlign.CENTER,
        }));
    }
});

/**
 * Extension part for audio.
 *
 * - Provide UI to activate desktop audio and mic audio.
 * - Provide pipeline description for activated audio sources.
 */
export class PartAudio extends PartBase.PartUI {
    constructor(screenshotUI, dir) {
        super(screenshotUI);
        this.typeButtonContainer = this.screenshotUI._typeButtonContainer;
        
        let iconsDir = dir.get_child("icons");

        // Add UI        
        this.desktopAudioButton = new IconLabelButton(
            new Gio.FileIcon({
                file: iconsDir.get_child("screenshot-ui-speaker-symbolic.svg")
            }),
            gettext("Desktop"),
            {
                constraints: new PixelConstraint(),
                style_class: 'screenshot-ui-type-button',
                toggle_mode: true,
                reactive: false
            }
        );
        

        this.micAudioButton = new IconLabelButton(
            new Gio.FileIcon({
                file: iconsDir.get_child("screenshot-ui-mic-symbolic.svg")
            }),
            gettext("Mic"),
            {
                constraints: new PixelConstraint(),
                style_class: 'screenshot-ui-type-button',
                toggle_mode: true,
                reactive: false
            }
        );

        this.desktopAudioTooltip = new Screenshot.Tooltip(
          this.desktopAudioButton,
          {
            style_class: 'screenshot-ui-tooltip',
            visible: false
          }
        );

        this.micAudioTooltip = new Screenshot.Tooltip(
          this.micAudioButton,
          {
            style_class: 'screenshot-ui-tooltip',
            visible: false
          }
        );

        this.typeButtonContainer.add_child(this.desktopAudioButton);
        this.typeButtonContainer.add_child(this.micAudioButton);

        this.screenshotUI.add_child(this.desktopAudioTooltip);
        this.screenshotUI.add_child(this.micAudioTooltip);


        // Mixer Control.
        this.mixerControl = new Gvc.MixerControl({name: "Extension Screencast with Audio"});
        this.mixerControl.open();

        this.mixerSinkChanged = this.mixerControl.connect(
          'default-sink-changed',
          (_object, _id) => {
            this._updateDesktopAudioButton();
          }
        );

        this.mixerSrcChanged = this.mixerControl.connect(
          'default-source-changed',
          (_object, _id) => {
            this._updateMicAudioButton();
          }
        );

        this._updateDesktopAudioButton();
        this._updateMicAudioButton();
    }

    /** @override */
    destroy() {
        if (this.mixerControl) {
            if (this.mixerSrcChanged) {
                this.mixerControl.disconnect(this.mixerSrcChanged);
                this.mixerSrcChanged = null;
            }

            if (this.mixerSinkChanged) {
                this.mixerControl.disconnect(this.mixerSinkChanged);
                this.mixerSinkChanged = null;
            }

            this.mixerControl.close();
            this.mixerControl = null;
        }

        if (this.screenshotUI) {
            if (this.desktopAudioTooltip) {
                this.screenshotUI.remove_child(this.desktopAudioTooltip);
                this.desktopAudioTooltip.destroy();
                this.desktopAudioTooltip = null;
            }

            if (this.micAudioTooltip) {
                this.screenshotUI.remove_child(this.micAudioTooltip);
                this.micAudioTooltip.destroy();
                this.micAudioTooltip = null;
            }
            this.screenshotUI = null;
        }

        if (this.typeButtonContainer) {
            if (this.desktopAudioButton) {
                this.typeButtonContainer.remove_child(this.desktopAudioButton);
                this.desktopAudioButton.destroy();
                this.desktopAudioButton = null;
            }

            if (this.micAudioButton) {
                this.typeButtonContainer.remove_child(this.micAudioButton);
                this.micAudioButton.destroy();
                this.micAudioButton = null;
            }
            this.typeButtonContainer = null;
        }

        super.destroy();
    }

    /** @override */
    onCastModeSelected(selected) {
        this._updateDesktopAudioButton();
        this._updateMicAudioButton();
    }

    /**
     * Make audio input as pipeline description.
     *
     * @returns {?string}
     */
    makeAudioInput() {
        var desktopAudioSource = null;
        var desktopAudioChannels = 0;
        if (this.desktopAudioButton.checked) {
            let sink = this.mixerControl.get_default_sink();
            let sinkName = sink.name;
            let sinkChannelMap = sink.channel_map;
            desktopAudioChannels = sinkChannelMap.get_num_channels();

            let monitorName = sinkName + ".monitor";
            let audioSourceComp = [
                `pulsesrc device=${monitorName} provide-clock=false`,

                // Need to specify channels, so that right channels are applied.
                `capsfilter caps=audio/x-raw,channels=${desktopAudioChannels}`
            ];
            desktopAudioSource = audioSourceComp.join(" ! ");
        }

        var micAudioSource = null;
        if (this.micAudioButton.checked) {
            let src = this.mixerControl.get_default_source();
            let srcName = src.name;
            let srcChannelMap = src.channel_map;
            let srcChannels = srcChannelMap.get_num_channels();
            let audioSourceComp = [
                `pulsesrc device=${srcName} provide-clock=false`,

                // Need to specify channels, so that right channels are applied.
                `capsfilter caps=audio/x-raw,channels=${srcChannels}`
            ];

            micAudioSource = audioSourceComp.join(" ! ");
        }

        if (desktopAudioSource !== null && micAudioSource !== null) {
            let segments = [
                `${desktopAudioSource} ! audiomixer name=am latency=100000000`,
                `${micAudioSource} ! am.`,
                `am. ! capsfilter caps=audio/x-raw,channels=${desktopAudioChannels}`
            ];

            return segments.join(" ");
        } else if (desktopAudioSource !== null) {
            return desktopAudioSource;
        } else if (micAudioSource !== null) {
            return micAudioSource;
        } else {
            return null;
        }
    }

    // Privates

    /**
     * Update to changed sink information.
     *
     * Sink is usually a output device like speaker.
     */
    _updateDesktopAudioButton() {
        if (! this.castModeSelected) {
            this.desktopAudioButton.reactive = false;
        } else {
            let sink = this.mixerControl.get_default_sink();
            this.desktopAudioButton.reactive = (sink !== null);

            if (sink) {
                let sinkPort = sink.get_port();
                this.desktopAudioTooltip.text =
                    gettext("Record Desktop Audio\n%s: %s")
                        .format (sinkPort.human_port, sink.description);
            } else {
                this.desktopAudioTooltip.text =
                    gettext("Cannot record Desktop Audio.\nNo audio device.");
            }
        }
    }

    /**
     * Update to changed source information.
     *
     * Source is usually a input device like microphone.
     */
    _updateMicAudioButton() {
        if (! this.castModeSelected) {
            this.micAudioButton.reactive = false;
        } else {
            let src = this.mixerControl.get_default_source();
            this.micAudioButton.reactive = (src !== null);

            if (src) {
                let srcPort = src.get_port();
                this.micAudioTooltip.text =
                    gettext("Record Mic Audio\n%s: %s")
                        .format(srcPort.human_port, src.description);
            } else {
                this.desktopAudioTooltip.text =
                    gettext("Cannot record Mic Audio.\nNo audio device.");
            }
        }
    }
}
