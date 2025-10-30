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

import GLib from 'gi://GLib';

// Shell imports

import {Extension, gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as PartAudio from "./parts/partaudio.js"
import * as PartFramerate from "./parts/partframerate.js"

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

export default class ScreencastExtraFeature extends Extension {
    enable() {
        // Internal variables.
        this._configureIndex = 0;
        this._optionFramerate = 30;

        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._showPointerButtonContainer = this._screenshotUI._showPointerButtonContainer;
        this._shotButton = this._screenshotUI._shotButton;
        this._typeButtonContainer = this._screenshotUI._typeButtonContainer;
        this._screencastProxy = this._screenshotUI._screencastProxy;

        // Extension parts.
        this._partAudio = new PartAudio.PartAudio(
            this._screenshotUI,
            this._typeButtonContainer
        );

        this._partFramerate = new PartFramerate.PartFramerate(
            this._screenshotUI,
            this._showPointerButtonContainer
        );

        // Connect to signals.
        this._shotButtonNotifyChecked = this._shotButton.connect (
          'notify::checked',
          (_object, _pspec) => {
              this._partAudio.set_enabled(!this._shotButton.checked);
              this._partFramerate.set_enabled(!this._shotButton.checked);
          }
        );

        // Monkey patch
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);
    }

    disable() {
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

        if (this._partAudio) {
            this._partAudio.destroy();
            this._partAudio = null;
        }

        if (this._partFramerate) {
            this._partFramerate.destroy();
            this._partFramerate = null;
        }


        if (this._screenshotUI) {
            this._screenshotUI = null;
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
        options['framerate'] = new GLib.Variant('i', this._partFramerate.get_framerate());
        while (this._configureIndex <= configures.length) {
            let configure = configures[this._configureIndex];

            let pipeline = this._makePipelineString(
                configure.videoPipeline,
                configure.audioPipeline,
                configure.muxer
            );

            if (pipeline) {
                options['pipeline'] = new GLib.Variant('s', pipeline);
            }

            try {
                var [success, filepath] = await this._origProxyScreencast.call(this._screencastProxy, filename, options);
                if (success) {
                    filepath = this._fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;
                console.log(`Tried configure [${this._configureIndex}] ${configure.id}`);
                console.log(`- VIDEO: ${configure.videoPipeline}`);
                console.log(`- AUDIO: ${configure.audioPipeline}`);
                console.log(`- MUXER: ${configure.muxer}`);
                console.log(`- ERROR: ${e}`);
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
        options['framerate'] = new GLib.Variant('i', this._partFramerate.get_framerate());
        while (this._configureIndex <= configures.length) {
            let configure = configures[this._configureIndex];

            let pipeline = this._makePipelineString(
                configure.videoPipeline,
                configure.audioPipeline,
                configure.muxer
            );

            if (pipeline) {
                options['pipeline'] = new GLib.Variant('s', pipeline);
            }

            try {
                var [success, filepath] = await this._origProxyScreencastArea.call(this._screencastProxy, x, y, w, h, filename, options);
                if (success && pipeline) {
                    filepath = this._fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;
                console.log(`Tried configure [${this._configureIndex}] ${configure.id}`);
                console.log(`- VIDEO: ${configure.videoPipeline}`);
                console.log(`- AUDIO: ${configure.audioPipeline}`);
                console.log(`- MUXER: ${configure.muxer}`);
                console.log(`- ERROR: ${e}`);
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

        // Split extension from file name
        var newFileStem = filepath;
        let lastPoint = filepath.lastIndexOf('.')
        if (lastPoint !== -1) {
            newFileStem = filepath.substring(0, lastPoint);
        }
        let newFilepath = `${newFileStem}.${extension}`;

        console.log(`- Into : ${newFilepath}`);

        // Rename the file. (using GLib.)
        GLib.rename(filepath, newFilepath);
        return newFilepath;
    }

    /// Make pipeline string for given set of pipeline descriptions.
    ///
    /// video: string: Video Pipeline.
    /// audio: string: Audio Pipeline.
    /// mux: string: Muxer pipeline.
    ///
    /// returns: string: A combined pipeline description.
    _makePipelineString(video, audio, mux) {
        let audioSource = this._partAudio.get_added_audio_input();

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
