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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gst from 'gi://Gst';

// Shell imports

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as PartAudio from "./parts/partaudio.js"
import * as PartFramerate from "./parts/partframerate.js"
import * as PartQuickStop from "./parts/partquickstop.js"
import * as PartDownsize from './parts/partdownsize.js';
import * as PartIndicator from "./parts/partindicator.js";

// Some Constants

// Audio Pipeline Description.

/** A pipeline for audio record, in vorbis. */
const VORBIS_PIPELINE = "vorbisenc ! queue";

/** A pipeline for audio record, in aac. */
const AAC_PIPELINE = "avenc_aac ! queue"


// Video conversion and resize.

const HWENC_DMABUF_PREP_PIPELINE = "vapostproc";

const SWENC_DMABUF_PREP_PIPELINE = "glupload ! glcolorconvert ! gldownload ! queue";

  // NOTE: To use glcolorscale, we have to color convert to RGBA.
const SWENC_DMABUF_PREP_DOWNSIZE_PIPELINE = "glupload ! glcolorconvert ! glcolorscale ! glcolorconvert ! gldownload ! queue";

const SWENC_MEMFD_PREP_PIPELINE = "videoconvert chroma-mode=none dither=none matrix-mode=output-only n-threads=%T ! videoscale ! queue"

/**
 * Configuration for pipeline.
 *
 * @typedef {object} Configure
 * @property {string} id Name of configuration.
 * @property {string} videoPrepPipeline Video Preparation pipeline.
 * @property {?string} videoPrepDownsizePipeline Video Preparation pipeline for downsize, or null to use #videoPrepPipeline.
 * @property {string} videoPipeline Video encode pipeline.
 * @property {string} audioPipeline Audio encode pipeline.
 * @property {string} muxer Muxer pipeline.
 * @property {string} extension Extension of file name.
 */

/**
 * Configuration for pipeline.
 * video pipelines are copied from gnome-shell screencast service.
 * They would be probably in separated service, so I cannot monkey-patch on it.
 *
 * @type {Configure[]}
 */
const CONFIGURES = [
  {
    id: "hwenc-cuda-h264-nvenc",
    videoPrepPipeline: "cudaupload ! cudaconvert",
    videoPrepDownsizePipeline: "cudaupload ! cudaconvertscale",
    videoPipeline: [
        "nvh264enc",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "hwenc-gl-h264-nvenc",
    videoPrepPipeline: "cudaupload", // Prefer cudaupload to gl pipeline.
    videoPrepDownsizePipeline: "glupload ! glcolorconvert ! glcolorscale",
    videoPipeline: [
        "nvh264enc",
        "queue",
        "h264parse"
    ].join(" ! "),
    audioPipeline: AAC_PIPELINE,
    muxer: "mp4mux fragment-duration=500 fragment-mode=first-moov-then-finalise",
    extension: "mp4"
  },
  {
    id: "hwenc-dmabuf-h264-vaapi-lp",
    videoPrepPipeline: HWENC_DMABUF_PREP_PIPELINE,
    videoPrepDownsizePipeline: null,
    videoPipeline: [
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
    videoPrepPipeline: HWENC_DMABUF_PREP_PIPELINE,
    videoPrepDownsizePipeline: null,
    videoPipeline: [
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
    videoPrepPipeline: SWENC_DMABUF_PREP_PIPELINE,
    videoPrepDownsizePipeline: SWENC_DMABUF_PREP_DOWNSIZE_PIPELINE,
    videoPipeline: [
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
    videoPrepPipeline: SWENC_MEMFD_PREP_PIPELINE,
    videoPrepDownsizePipeline: null,
    videoPipeline: [
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
    videoPrepPipeline: SWENC_DMABUF_PREP_PIPELINE,
    videoPrepDownsizePipeline: SWENC_DMABUF_PREP_DOWNSIZE_PIPELINE,
    videoPipeline: [
        "vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000",
        "queue",
    ].join(" ! "),
    audioPipeline: VORBIS_PIPELINE,
    muxer: "webmmux",
    extension: "webm"
  },
  {
    id: "swenc-memfd-vp8-vp8enc",
    videoPrepPipeline: SWENC_MEMFD_PREP_PIPELINE,
    videoPrepDownsizePipeline: null,
    videoPipeline: [
      'vp8enc cpu-used=16 max-quantizer=17 deadline=1 keyframe-mode=disabled threads=%T static-threshold=1000 buffer-size=20000',
      'queue'
    ].join(" ! "),
    audioPipeline: VORBIS_PIPELINE,
    muxer: "webmmux",
    extension: "webm"
  }
];


/**
 * Fix file path with wrong extension.
 *
 * Usually to fix '.unknown' file path.
 *
 * @param {string} filepath A filepath, with worng extension.
 * @param {string} extension Desired extension of the file.
 * @returns {string} The new file path.
 */
function fixFilePath(filepath, extension) {
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

/**
 * Check that element exists.
 *
 * NOTE: This just checks existence of elements. Element's availability is
 * not known. (like missing GPU or something...)
 *
 * NOTE: This launches extenral process `gst-inspect-1.0 --exists ${element}`
 *   The extension used to use GStreamer, but sometimes Gst.init(...) in
 *   extension would freeze up whole gnome-shell.
 *
 * @param {string} element Element
 * @returns {Promise<boolean>} Whether the element is available.
 */
async function checkElement(element) {
    return new Promise ((resolve) => {
        let sub = new Gio.Subprocess({
            argv: ["gst-inspect-1.0", "--exists", element],
            flags: Gio.SubprocessFlags.NONE
        });
        sub.init(null);

        sub.wait_async(null, (src, result) => {
            src.wait_finish(result);
            resolve(src.get_exit_status() == 0);
        });
    });
}


/**
 * Check that pipeline can be created properly.
 *
 * NOTE: This just checks existence of elements. Element's availability is
 * not known. (like missing GPU or something...)
 *
 * @param {string} pipeline Pipeline
 * @param {Map<string, Promise<boolean>>} availabilityMap Availability Map to cache result.
 * @returns {Promise<boolean>} Whether the pipeline is available.
 */
async function checkPipeline(pipeline, availabilityMap) {
    let words = pipeline.split(/\s+/);
    let elements = words.filter((word) => {
        return ! (
            word.includes(".") || // object reference (ex. "mux.")
            word.includes("=") || // property (ex. "name=value")
            word.includes("!")    // element separator '!'
        );
    });

    let promises = elements.map ((elem) => {
        if (availabilityMap.has(elem)) {
            return availabilityMap.get(elem);
        } else {
            let availability = checkElement(elem);
            availabilityMap.set(elem, availability);
            return availability;
        }
    });

    let results = await Promise.all(promises);

    return results.every(res => res);
}

/**
 * Check that configure can be created properly.
 *
 * @param {Configure} configure Configure.
 * @param {Map<string, Promise<boolean>>} availabilityMap Availability Map to cache result.
 * @returns {Promise<boolean>} Whether the configure is available to use.
 */
async function checkConfigure(configure, availabilityMap) {
    let promises = [
        checkPipeline(configure.videoPrepPipeline, availabilityMap),
        checkPipeline(configure.videoPipeline, availabilityMap),
        checkPipeline(configure.audioPipeline, availabilityMap),
        checkPipeline(configure.muxer, availabilityMap)
    ];

    let results = await Promise.all(promises);

    return results.every(res => res);
}

export default class ScreencastExtraFeature extends Extension {
    enable() {
        // Internal variables.

        /** @type {?Configure[]} */
        this._configures = null;
        this._configureIndex = 0;

        // Reference from Main UI
        this._screenshotUI = Main.screenshotUI;
        this._screenRecordingIndicator = Main.panel.statusArea.screenRecording;

        // Extension parts.
        this._partAudio = new PartAudio.PartAudio(this._screenshotUI, this.dir);
        this._partFramerate = new PartFramerate.PartFramerate(this._screenshotUI);
        this._partDownsize = new PartDownsize.PartDownsize(this._screenshotUI);
        this._partQuickStop = new PartQuickStop.PartQuickStop(this._screenshotUI);
        this._partIndicator = new PartIndicator.PartIndicator(this._screenshotUI, this._screenRecordingIndicator);

        // Monkey patch
        this._screencastProxy = this._screenshotUI._screencastProxy;
        this._origProxyScreencast = this._screencastProxy.ScreencastAsync;
        this._origProxyScreencastArea = this._screencastProxy.ScreencastAreaAsync;

        this._screencastProxy.ScreencastAsync = this._screencastAsync.bind(this);
        this._screencastProxy.ScreencastAreaAsync = this._screencastAreaAsync.bind(this);

        this._initConfigure();
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

        // Destroy parts.
        if (this._partIndicator) {
            this._partIndicator.destroy();
            this._partIndicator = null;
        }

        if (this._partAudio) {
            this._partAudio.destroy();
            this._partAudio = null;
        }

        if (this._partFramerate) {
            this._partFramerate.destroy();
            this._partFramerate = null;
        }

        if (this._partDownsize) {
            this._partDownsize.destroy();
            this._partDownsize = null;
        }

        if (this._partQuickStop) {
            this._partQuickStop.destroy();
            this._partQuickStop = null;
        }

        this._screen
        this._screenshotUI = null;

        // Internal variables
        this._configures = null;
    }

    // Privates

    /**
     * Monkey patch for screencast async.
     *
     * Modify option for our configuration.
     *
     * @param {string} filename File name without extension.
     * @param {object} options Options for screen cast.
     * @returns {[boolean, string]} Success and the result filename with extension.
     */
    async _screencastAsync(filename, options) {
        return this._screencastCommonAsync (
            global.screen_width, global.screen_height, options,
            this._origProxyScreencast.bind(this._screencastProxy, filename)
        );
    }

    /**
     * Monkey patch for screencast async.
     *
     * Modify option for our configuration.
     *
     * @param {number} x left coordinate of area.
     * @param {number} y top coordinate or area.
     * @param {number} w Width of area.
     * @param {number} h Height of area.
     * @param {string} filename File name without extension.
     * @param {object} options Options for screen cast.
     * @returns {[boolean, string]} Success and the result filename with extension.
     */
    async _screencastAreaAsync(x, y, w, h, filename, options) {
        return this._screencastCommonAsync (w, h, options,
            this._origProxyScreencastArea.bind(this._screencastProxy, x, y, w, h, filename)
        );
    }

    /**
     * Common pre-action and post-action for screen cast request.
     *
     * - Initialize configure.
     * - Modify options (framerate, pipeline)
     * - Fix file name
     * - Print logs
     * - Try next configure if failed.
     *
     * @param {number} width Width of screen cast area.
     * @param {number} height Height of screen cast area.
     * @param {object} options Option for screen cast.
     * @param {(options: object) => Promise<[boolean, string]>} body
     *        An async callback that accepts modified option, and result in file
     *        path and success.
     * @returns {[boolean, string]} Result of body, with fixed file path.
     */
    async _screencastCommonAsync(width, height, options, body) {
        this._partIndicator.onPipelineSetupBegin();
        options['framerate'] = new GLib.Variant('i', this._partFramerate.selectedItem);
        while (this._configureIndex <= this._configures.length) {
            let configure = this._configures[this._configureIndex];

            let pipeline = this._makePipelineString(configure, width, height);
            options['pipeline'] = new GLib.Variant('s', pipeline);

            try {
                var [success, filepath] = await body(options);
                if (success) {
                    this._partIndicator.onPipelineSetupDone();
                    filepath = fixFilePath(filepath, configure.extension);
                }
                return [success, filepath];
            } catch (e) {
                this._configureIndex++;

                var videoPrep = configure.videoPrepPipeline;
                if (this._partDownsize.selectedItem != 1.00) {
                    videoPrep =
                        configure.videoPrepDownsizePipeline ||
                        configure.videoPrepPipeline;
                }

                console.log(`Tried configure [${this._configureIndex}] ${configure.id}`);
                console.log(`- VIDEO_PREP: ${videoPrep}`);
                console.log(`- VIDEO: ${configure.videoPipeline}`);
                console.log(`- AUDIO: ${configure.audioPipeline}`);
                console.log(`- MUXER: ${configure.muxer}`);
                console.log(`- ERROR: ${e}`);
            }
        }

        // If it reached here, all of pipeline configures are failed.
        throw Error("Tried all configure and failed!");
    }

    /**
     * Perform configuration initialization.
     */
    async _initConfigure() {
        if (this._configures === null) {
            try {
                let availabilityMap = new Map();
                let promises = CONFIGURES.map((conf) => checkConfigure(conf, availabilityMap));
                let checkResults = await Promise.all(promises);
                this._configures = CONFIGURES.filter((_, index) => checkResults[index]);
            } catch (e) {
                console.log(`Configuration filtering fails: ${e}`);
                console.log(`Fallback to use all configures.`);
                this._configures = CONFIGURES;
            }
            this._configureIndex = 0;

            console.log("Using following configure...");
            for (let conf of this._configures) {
                console.log(`- ${conf.id}`)
            }
        }
    }

    /**
     * Make pipeline string for given set of pipeline descriptions.
     *
     * @param {Configure} configure A configure to form pipeline string.
     * @param {number} width Width of screen cast.
     * @param {number} height Height of screen cast.
     * @returns {string} A combined pipeline description.
     */
    _makePipelineString(configure, width, height) {
        var videoSeg = null;
        let video = configure.videoPipeline;
        let muxer = configure.muxer;

        let downsizeRatio = this._partDownsize.selectedItem;
        if (downsizeRatio != 1.00) {
            let videoPrep =
                configure.videoPrepDownsizePipeline ||
                configure.videoPrepPipeline;

            let downsizeWidth = Math.floor(width * downsizeRatio);
            let downsizeHeight = Math.floor(height * downsizeRatio);
            let downsizeCap = `video/x-raw(ANY),width=${downsizeWidth},height=${downsizeHeight}`

            videoSeg = `${videoPrep} ! ${downsizeCap} ! ${video} ! ${muxer} name=mux`;
        } else {
            let videoPrep = configure.videoPrepPipeline;

            videoSeg = `${videoPrep} ! ${video} ! ${muxer} name=mux`;
        }
        let audioSource = this._partAudio.makeAudioInput();
        if (audioSource === null) {

            // If we don't use audio, we can just use video segment only.

            return videoSeg;
        } else {

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

            let audio = configure.audioPipeline;
            let audioSeg = `${audioSource} ! ${audio} ! mux.`;
            let muxerSeg = "mux.";

            return `${videoSeg} ${audioSeg} ${muxerSeg}`;
        }
    }
}
