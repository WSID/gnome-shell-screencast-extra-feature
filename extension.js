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
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

// Some Constants

// Copied from Gnome Shell Screencast Service. This is probably in separated process, so I cannot monkey-patch on it.


const VORBIS_PIPELINE = "vorbisenc ! queue";
const AAC_PIPELINE = "avenc_aac ! queue"

const configures = [
  {
    id: "hwenc-dmabuf-h264-vaapi-lp",
    videoPipeline: [
        "vapostproc",
        "vah264lpenc",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "hwenc-dmabuf-h264-vaapi",
    videoPipeline: [
        "vapostproc",
        "vah264enc",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "swenc-dmabuf-h264-openh264",
    videoPipeline: [
        "glupload ! glcolorconvert ! gldownload ! queue",
        "openh264enc deblocking=off background-detection=false complexity=low adaptive-quantization=false qp-max=26 qp-min=26 multi-thread=%T slice-mode=auto",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "swenc-memfd-h264-openh264",
    videoPipeline: [
        "videoconvert chroma-mode=none dither=none matrix-mode=output-only n-threads=%T",
        "queue",
        "openh264enc deblocking=off background-detection=false complexity=low adaptive-quantization=false qp-max=26 qp-min=26 multi-thread=%T slice-mode=auto",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "swenc-dmabuf-vp8-vp8enc",
    videoPipeline: [
        "glupload ! glcolorconvert ! gldownload ! queue",
        "vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000",
        "queue",
    ].join(" ! "),
    audioPipeline: VORBIS_PIPELINE,
    muxer: "webmmux",
    extension: "webm"
  },
  {
    id: "swenc-memfd-vp8-vp8enc",
    videoPipeline: [
      'videoconvert chroma-mode=none dither=none matrix-mode=output-only n-threads=%T',
      'queue',
      'vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000',
      'queue'
    ].join(" ! "),
    audioPipeline: VORBIS_PIPELINE,
    muxer: "webmmux",
    extension: "webm"
  }
];



export default class ScreencastExtraFeature extends Extension {
    enable() {
        // Internal variables.
        this._configureIndex = 0;

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

        this._desktopAudioTooltip = new Screenshot.Tooltip(
          this._desktopAudioButton,
          {
            text: 'Record Desktop Audio',
            style_class: 'screenshot-ui-tooltip',
            visible: false
          }
        );

        this._micAudioTooltip = new Screenshot.Tooltip(
          this._micAudioButton,
          {
            text: 'Record Mic Audio',
            style_class: 'screenshot-ui-tooltip',
            visible: false
          }
        );

        // Add widgets
        this._showPointerButtonContainer.insert_child_at_index(
          this._desktopAudioButton,
          0
        );
        this._showPointerButtonContainer.insert_child_at_index(
          this._micAudioButton,
          1
        );

        this._screenshotUI.add_child(this._desktopAudioTooltip);
        this._screenshotUI.add_child(this._micAudioTooltip);

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

        this._mixerSinkChanged = this._mixerControl.connect(
          'default-sink-changed',
          (_object, _id) => {
            this._onSinkChanged();
          }
        );

        this._mixerSrcChanged = this._mixerControl.connect(
          'default-source-changed',
          (_object, _id) => {
            this._onSrcChanged();
          }
        );

        this._onSinkChanged();
        this._onSrcChanged();

        // Monkey patch
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);
    }

    disable() {
        this._shotButton.disconnect(this._shotButtonNotifyChecked);
        this._screenshotUI.remove_child(this._desktopAudioTooltip);
        this._screenshotUI.remove_child(this._micAudioTooltip);
        this._showPointerButtonContainer.remove_child(this._desktopAudioButton);
        this._showPointerButtonContainer.remove_child(this._micAudioButton);

        // Revert Monkey patch
        this._screencastProxy.ScreencastAsync = this._origProxyScreencast;
        this._screencastProxy.ScreencastAreaAsync = this._origProxyScreencastArea;

        this._mixerControl.disconnect(this._mixerSrcChanged);
        this._mixerControl.disconnect(this._mixerSinkChanged);
        this._mixerControl.close();
    }

    // Privates

    async _screencastAsync(filename, options) {
        while (this._configureIndex <= configures.length) {
            try {
                let configure = configures[this._configureIndex];

                let pipeline = this._makePipelineString(
                    configure.videoPipeline,
                    configure.audioPipeline,
                    configure.muxer
                );

                console.log(pipeline);

                if (pipeline) {
                    options['pipeline'] = new GLib.Variant('s', pipeline);
                }
                var [success, filepath] = await this._origProxyScreencast.call(this._screencastProxy, filename, options);
                if (success) {
                    filepath = this._fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;
            }
        }

        // If it reached here, all of pipeline configures are failed.
        throw Error("Tried all configure and failed!");
    }

    async _screencastAreaAsync(x, y, w, h, filename, options) {
        while (this._configureIndex <= configures.length) {
            try {
                let configure = configures[this._configureIndex];

                let pipeline = this._makePipelineString(
                    configure.videoPipeline,
                    configure.audioPipeline,
                    configure.muxer
                );

                console.log(pipeline);

                if (pipeline) {
                    options['pipeline'] = new GLib.Variant('s', pipeline);
                }
                var [success, filepath] = await this._origProxyScreencastArea.call(this._screencastProxy, x, y, w, h, filename, options);
                if (success) {
                    filepath = this._fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;
            }
        }

        // If it reached here, all of pipeline configures are failed.
        throw Error("Tried all configure and failed!");
    }

    _fixFilePath(filepath, extension) {
        console.log(`Fix file path: ${filepath}`);

        let hasDesktopAudio = this._desktopAudioButton.checked;
        let hasMicAudio = this._micAudioButton.checked;

        if (hasDesktopAudio || hasMicAudio) {
            // Split extension from file name
            let lastPoint = filepath.lastIndexOf('.')
            if (lastPoint !== -1) {
                let newFileStem = filepath.substring(0, lastPoint);
                let newFilepath = `${newFileStem}.${extension}`;

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
        var desktopAudioSource = null;
        var desktopAudioChannels = 0;
        if (this._desktopAudioButton.checked) {
            let sink = this._mixerControl.get_default_sink();
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
        if (this._micAudioButton.checked) {
            let src = this._mixerControl.get_default_source();
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

        var audioSource = null;
        if (desktopAudioSource !== null && micAudioSource !== null) {
            let segments = [
                `${desktopAudioSource} ! audiomixer name=am latency=100000000`,
                `${micAudioSource} ! am.`,
                `am. ! capsfilter caps=audio/x-raw,channels=${desktopAudioChannels}`
            ];

            audioSource = segments.join(" ");
        } else if (desktopAudioSource !== null) {
            audioSource = desktopAudioSource;
        } else if (micAudioSource !== null) {
            audioSource = micAudioSource;
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

    _onSinkChanged() {
        let sink = this._mixerControl.get_default_sink();
        let sinkPort = sink.get_port();
        this._desktopAudioTooltip.text = `Record Desktop Audio\n${sinkPort.human_port}: ${sink.description}`;
    }

    _onSrcChanged() {
        let src = this._mixerControl.get_default_source();
        let srcPort = src.get_port();
        this._micAudioTooltip.text = `Record Mic Audio\n${srcPort.human_port}: ${src.description}`;
    }
}
