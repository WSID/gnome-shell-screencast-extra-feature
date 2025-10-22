/* extension.js
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

import St from 'gi://St';
import Gvc from 'gi://Gvc';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Some Constants

// Copied from Gnome Shell Screencast Service. This is probably in separated process, so I cannot monkey-patch on it.


const VIDEO_COMPONENT = [
  'videoconvert chroma-mode=none dither=none matrix-mode=output-only n-threads=%T',
  'queue',
  'vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000',
  'queue'
];

const VIDEO_PIPELINE = VIDEO_COMPONENT.join(' ! ');

const AUDIO_COMPONENT = [
  'audioconvert',
  'queue',
  'vorbisenc',
  'queue'
];

const AUDIO_PIPELINE = AUDIO_COMPONENT.join(' ! ');

const MUX_PIPELINE = 'webmmux';

const MUX_EXTENSION = 'webm';


export default class ScreencastWithAudio extends Extension {
    enable() {
        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._showPointerButtonContainer = this._screenshotUI._showPointerButtonContainer;
        this._showPointerButton = this._screenshotUI._showPointerButton;
        this._shotButton = this._screenshotUI._shotButton;
        this._screencastProxy = this._screenshotUI._screencastProxy;

        // Created widgets
        this._desktopAudioButton = new St.Button({
          style_class: 'screenshot-ui-show-pointer-button',
          icon_name: 'audio-speakers-symbolic',
          toggle_mode: true,
          visible: ! this._shotButton.checked
        });
        this._micAudioButton = new St.Button({
          style_class: 'screenshot-ui-show-pointer-button',
          icon_name: 'audio-input-microphone-symbolic',
          toggle_mode: true,
          visible: ! this._shotButton.checked
        });

        // Add widgets
        this._showPointerButtonContainer.insert_child_at_index(
          this._desktopAudioButton,
          0
        );
        this._showPointerButtonContainer.insert_child_at_index(
          this._micAudioButton,
          1
        );

        // connect to signals.
        this._shotButtonNotifyChecked = this._shotButton.connect (
          'notify::checked',
          (_object, _pspec) => {
            this._desktopAudioButton.visible = ! this._shotButton.checked
            this._micAudioButton.visible = ! this._shotButton.checked
          }
        );

        // Created control
        this._mixerControl = new Gvc.MixerControl({name: "Extension Screencast with Audio"});
        this._mixerControl.open();

        // Monkey patch
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);
    }

    disable() {
        this._shotButton.disconnect(this._shotButtonNotifyChecked);
        this._showPointerButtonContainer.remove_child(this._desktopAudioButton);
        this._showPointerButtonContainer.remove_child(this._micAudioButton);

        // Revert Monkey patch
        this._screencastProxy.ScreencastAsync = this._origProxyScreencast;
        this._screencastProxy.ScreencastAreaAsync = this._origProxyScreencastArea;

        this._mixerControl.close();
    }

    // Privates

    async _screencastAsync(filename, options) {
        try {
            let pipeline = this._makePipelineString(VIDEO_PIPELINE, AUDIO_PIPELINE, MUX_PIPELINE);
            if (pipeline) {
                options['pipeline'] = new GLib.Variant('s', pipeline);
            }
            var [success, filepath] = await this._origProxyScreencast.call(this._screencastProxy, filename, options);
            if (success) {
                filepath = this._fixFilePath(filepath);
            }
            return [success, filepath];
        } catch (e) {
            print(e);
            throw e;
        }
    }

    async _screencastAreaAsync(x, y, w, h, filename, options) {
        try {
            let pipeline = this._makePipelineString(VIDEO_PIPELINE, AUDIO_PIPELINE, MUX_PIPELINE);
            if (pipeline) {
                options['pipeline'] = new GLib.Variant('s', pipeline);
            }
            var [success, filepath] = await this._origProxyScreencastArea.call(this._screencastProxy, x, y, w, h, filename, options);
            if (success) {
                filepath = this._fixFilePath(filepath);
            }
            return [success, filepath];
        } catch (e) {
            console.warn(e);
            throw e;
        }
    }

    _fixFilePath(filepath) {
        console.log(`Fix file path: ${filepath}`);

        let hasDesktopAudio = this._desktopAudioButton.checked;
        let hasMicAudio = this._micAudioButton.checked;

        if (hasDesktopAudio || hasMicAudio) {
            // Split extension from file name
            let lastPoint = filepath.lastIndexOf('.')
            if (lastPoint !== -1) {
                let newFileStem = filepath.substring(0, lastPoint);
                let newFilepath = `${newFileStem}.${MUX_EXTENSION}`;

                console.log(`- Into : ${newFilepath}`);

                // Rename the file. (using GLib.)
                GLib.rename(filepath, newFilepath);
                return newFilepath;
            }
        } else {
            return filepath;
        }
    }

    _makePipelineString(video, audio, mux) {
        let hasDesktopAudio = this._desktopAudioButton.checked;
        let hasMicAudio = this._micAudioButton.checked;

        var audioSource = null
        if (hasDesktopAudio && hasMicAudio) {
            // TODO: Mix them
        } else if (hasDesktopAudio) {
            let sink = this._mixerControl.get_default_sink();
            let sinkName = sink.name;
            let sinkChannelMap = sink.channel_map;
            let sinkChannels = sinkChannelMap.get_num_channels();
            let monitorName = sinkName + ".monitor";
            let audioSourceComp = [
                `pulsesrc device=${monitorName}`,

                // Need to specify channels, so that right channels are applied.
                `capsfilter caps=audio/x-raw,channels=${sinkChannels}`
            ];

            audioSource = audioSourceComp.join(" ! ");
        } else if (hasMicAudio) {
            let src = this._mixerControl.get_default_source();
            let srcName = src.name;
            let srcChannelMap = src.channel_map;
            let srcChannels = srcChannelMap.get_num_channels();
            let audioSourceComp = [
                `pulsesrc device=${srcName}`,
                // Need to specify channels, so that right channels are applied.
                `capsfilter caps=audio/x-raw,channels=${srcChannels}`
            ];

            audioSource = audioSourceComp.join(" ! ");
        }


        if (audioSource !== null) {
            // Put 3 segments as pipeline description string.
            //
            // As screen cast service will prepend and append video source and
            //    file sink.
            //
            // 1. video pipeline -> mux
            //    First segment will be prepend with video source.
            //
            // 2. audio source -> audio pipeline -> mux
            //
            // 3. mux
            //    Last segment will be append with file sink.

            let segments = [
                // First segment will be plugged from video source.
                // Also define mux element and give it name.
                `${video} ! ${mux} name=mux`,

                `${audioSource} ! ${audio} ! mux.`,

                // Last segment will be plugged to file sink.
                "mux."
            ];

            return segments.join(" ");
        } else {
            return null;
        }
    }
}
