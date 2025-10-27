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

// GIR imports

import Clutter from 'gi://Clutter'
import GObject from 'gi://GObject'
import GLib from 'gi://GLib';
import Gvc from 'gi://Gvc';
import St from 'gi://St';


// Shell imports

import {Extension, gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';


// Some Constants

/// A pipeline for audio record, in vorbis.
const VORBIS_PIPELINE = "vorbisenc ! queue";

/// A pipeline for audio record, in aac.
const AAC_PIPELINE = "avenc_aac ! queue"

/// Configuration for pipeline.
/// video pipelines are copied from gnome-shell screencast service.
/// They would be probably in separated service, so I cannot monkey-patch on it.
///
/// It is array of objects.
/// - id: Name of configuration.
/// - videoPipeline: Video Pipeline.
/// - audioPipeline: Audio Pipeline.
/// - muxer: A muxer to mux video and audio.
/// - extension: Extension of the screencast file.
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

/// Icon Label Button that used in screen shot UI.
///
/// Copied from gnome-shell.
const IconLabelButton = GObject.registerClass(
class IconLabelButton extends St.Button {
    _init(iconName, label, params) {
        super._init(params);

        this._container = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'icon-label-button-container',
        });
        this.set_child(this._container);

        this._container.add_child(new St.Icon({icon_name: iconName}));
        this._container.add_child(new St.Label({
            text: label,
            x_align: Clutter.ActorAlign.CENTER,
        }));
    }
});

export default class ScreencastExtraFeature extends Extension {
    enable() {
        // Internal variables.
        this._configureIndex = 0;

        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._typeButtonContainer = this._screenshotUI._typeButtonContainer;
        this._showPointerButtonContainer = this._screenshotUI._showPointerButtonContainer;
        this._shotButton = this._screenshotUI._shotButton;
        this._screencastProxy = this._screenshotUI._screencastProxy;

        // Create widgets and tooltips.
        this._desktopAudioButton = new IconLabelButton(
            "audio-speakers-symbolic",
            gettext("Desktop Audio"),
            {
                style_class: 'screenshot-ui-type-button',
                toggle_mode: true,
                x_expand: true,
                reactive: this._shotButton.checked
            }
        );

        this._micAudioButton = new IconLabelButton(
            "audio-input-microphone-symbolic",
            gettext("Mic Audio"),
            {
                style_class: 'screenshot-ui-type-button',
                toggle_mode: true,
                x_expand: true,
                reactive: this._shotButton.checked
            }
        );

        this._desktopAudioTooltip = new Screenshot.Tooltip(
          this._desktopAudioButton,
          {
            style_class: 'screenshot-ui-tooltip',
            visible: false
          }
        );

        this._micAudioTooltip = new Screenshot.Tooltip(
          this._micAudioButton,
          {
            style_class: 'screenshot-ui-tooltip',
            visible: false
          }
        );

        this._typeButtonContainer.add_child(this._desktopAudioButton);
        this._typeButtonContainer.add_child(this._micAudioButton);

        this._screenshotUI.add_child(this._desktopAudioTooltip);
        this._screenshotUI.add_child(this._micAudioTooltip);

        // Connect to signals.
        this._shotButtonNotifyChecked = this._shotButton.connect (
          'notify::checked',
          (_object, _pspec) => {
              this._updateDesktopAudioButton();
              this._updateMicAudioButton();
          }
        );

        // Create control - to get default devices.
        this._mixerControl = new Gvc.MixerControl({name: "Extension Screencast with Audio"});
        this._mixerControl.open();

        this._mixerSinkChanged = this._mixerControl.connect(
          'default-sink-changed',
          (_object, _id) => {
            this._updateDesktopAudioButton();
          }
        );

        this._mixerSrcChanged = this._mixerControl.connect(
          'default-source-changed',
          (_object, _id) => {
            this._updateMicAudioButton();
          }
        );

        this._updateDesktopAudioButton();
        this._updateMicAudioButton();

        // Monkey patch
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);
    }

    disable() {
        // Release Mixer Control
        if (this._mixerControl) {
            if (this._mixerSrcChanged) {
                this._mixerControl.disconnect(this._mixerSrcChanged);
                this._mixerSrcChanged = null;
            }

            if (this._mixerSinkChanged) {
                this._mixerControl.disconnect(this._mixerSinkChanged);
                this._mixerSinkChanged = null;
            }

            this._mixerControl.close();
            this._mixerControl = null;
        }

        // Revert Monkey patch
        if (this._screencastProxy) {
            if (this._origProxyScreencast) {
                this._screencastProxy.ScreencastAsync = this._origProxyScreencast;
                this._origProxyScreencast = null;
            }

            if (this._origProxyScreencastArea) {
                this._screencastProxy.ScreencastAreaAsync = this._origProxyScreencastArea;
                this._origProxyScreencastArea = null;
            }

            this._screencastProxy = null;
        }

        // Revert UI
        if (this._shotButton) {
            if (this._shotButtonNotifyChecked) {
                this._shotButton.disconnect(this._shotButtonNotifyChecked);
                this._shotButtonNotifyChecked = null;
            }
            this._shotButton = null;
        }

        if (this._screenshotUI) {
            if (this._desktopAudioTooltip) {
                this._screenshotUI.remove_child(this._desktopAudioTooltip);
                this._desktopAudioTooltip.destroy();
                this._desktopAudioTooltip = null;
            }

            if (this._micAudioTooltip) {
                this._screenshotUI.remove_child(this._micAudioTooltip);
                this._micAudioTooltip.destroy();
                this._micAudioTooltip = null;
            }
            this._screenshotUI = null;
        }

        if (this._typeButtonContainer) {
            if (this._desktopAudioButton) {
                this._typeButtonContainer.remove_child(this._desktopAudioButton);
                this._desktopAudioButton.destroy();
                this._desktopAudioButton = null;
            }

            if (this._micAudioButton) {
                this._typeButtonContainer.remove_child(this._micAudioButton);
                this._micAudioButton.destroy();
                this._micAudioButton = null;
            }
            this._typeButtonContainer = null;
        }

        if (this._showPointerButtonContainer) {
            this._showPointerButtonContainer = null;
        }
    }

    // Privates

    /// Monkey patch for screencast async.
    ///
    /// Modify option for our configuration.
    ///
    /// filename: string: File name without extension.
    /// options: object: Options for screen cast.
    ///
    /// returns: (boolean, string): Success and the result filename with extension.
    async _screencastAsync(filename, options) {
        while (this._configureIndex <= configures.length) {
            try {
                let configure = configures[this._configureIndex];

                let pipeline = this._makePipelineString(
                    configure.videoPipeline,
                    configure.audioPipeline,
                    configure.muxer
                );

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

    /// Monkey patch for screencast async.
    ///
    /// Modify option for our configuration.
    ///
    /// x: number: left coordinate of area.
    /// y: number: top coordinate or area.
    /// w: number: Width of area.
    /// h: number: Height of area.
    /// filename: string: File name without extension.
    /// options: object: Options for screen cast.
    ///
    /// returns: (boolean, string): Success and the result filename with extension.
    async _screencastAreaAsync(x, y, w, h, filename, options) {
        while (this._configureIndex <= configures.length) {
            try {
                let configure = configures[this._configureIndex];

                let pipeline = this._makePipelineString(
                    configure.videoPipeline,
                    configure.audioPipeline,
                    configure.muxer
                );

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

    /// Fix file path with wrong extension.
    ///
    /// Usually to fix '.unknown' file path.
    ///
    /// filepath: string: A filepath, with worng extension.
    /// extension: string: Desired extension of the file.
    ///
    /// returns: string: The new file path.
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

    /// Make pipeline string for given set of pipeline descriptions.
    ///
    /// video: string: Video Pipeline.
    /// audio: string: Audio Pipeline.
    /// mux: string: Muxer pipeline.
    ///
    /// returns: string: A combined pipeline description.
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

    /// Update to changed sink information.
    ///
    /// Sink is usually a output device like speaker.
    _updateDesktopAudioButton() {
        if (this._shotButton.checked) {
            this._desktopAudioButton.reactive = false;
        } else {
            let sink = this._mixerControl.get_default_sink();
            this._desktopAudioButton.reactive = (sink !== null);

            if (sink) {
                let sinkPort = sink.get_port();
                this._desktopAudioTooltip.text =
                    gettext("Record Desktop Audio\n%s: %s")
                        .format (sinkPort.human_port, sink.description);
            } else {
                this._desktopAudioTooltip.text =
                    gettext("Cannot record Desktop Audio.\nNo audio device.");
            }
        }
    }

    /// Update to changed source information.
    ///
    /// Source is usually a input device like microphone.
    _updateMicAudioButton() {
        if (this._shotButton.checked) {
            this._micAudioButton.reactive = false;
        } else {
            let src = this._mixerControl.get_default_source();
            this._micAudioButton.reactive = (src !== null);

            if (src) {
                let srcPort = src.get_port();
                this._micAudioTooltip.text =
                    gettext("Record Mic Audio\n%s: %s")
                        .format(srcPort.human_port, src.description);
            } else {
                this._desktopAudioTooltip.text =
                    gettext("Cannot record Mic Audio.\nNo audio device.");
            }
        }
    }
}
