/* partpipeline.js
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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import {gettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';

let [SHELL_MAJOR, _] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

const KEY_PIPELINE_CONFIGURES = "pipeline-configures";

/**
 * Configure type.
 *
 * @typedef {[String, String, String, String, String, String, String]} Configure
 */

/**
 * Part Pipeline.
 *
 * Handles Pipeline Options.
 */
export class PartPipeline {
    constructor(window, path, settings) {
        this._path = path;
        this._settings = settings;

        /**
         * Pipeline Configure.
         * @type {Array<Configure>}
         */
        this._configures = this._settings.get_value(KEY_PIPELINE_CONFIGURES).recursiveUnpack();

        /**
         * Rows for Pipeline Configure.
         * @type {Array<Adw.PreferencesRow>}
         */
        this._configureRows = [];

        /**
         * Page for this part.
         * @type {Adw.PreferencesPage}
         */
        this.page = null;

        /**
         * @type {Adw.PreferencesGroup}
         */
        this._configureGroup = null;

        /**
         * @type {Adw.AlertDialog}
         */
        this._dialogAlertReset = null;

        let builder = new Gtk.Builder();
        if (SHELL_MAJOR <= 46) {
            builder.add_from_file(`${path}/ui/preferencePipelineButtons46.ui`);
        } else {
            builder.add_from_file(`${path}/ui/preferencePipelineButtons.ui`);
        }
        builder.add_from_file(`${path}/ui/preferencePipeline.ui`);

        this.page = builder.get_object("page");
        this._configureGroup = builder.get_object("configure_group");
        this._buttonsGroup = builder.get_object("buttons_group");
        this._dialogAlertReset = builder.get_object("dialog_alert_reset");

        this._configureGroup.add(this._buttonsGroup);

        let variantTypeU32 = new GLib.VariantType("u");

        let configuresActionGroup = new Gio.SimpleActionGroup();


        let configuresActionEdit = new Gio.SimpleAction({
            name: "edit",
            parameter_type: variantTypeU32,
        });
        configuresActionEdit.connect("activate", (_action, param) => {
            let index = param.get_uint32();
            this.editConfigure(window, index);
        });

        let configuresActionCopy = new Gio.SimpleAction({
            name: "copy",
            parameter_type: variantTypeU32,
        });
        configuresActionCopy.connect("activate", (_action, param) => {
            let index = param.get_uint32();
            let configure = Array.from(this._configures[index]);
            configure[0] += " (copy)";
            this._configures.splice(index + 1, 0, configure);
            this.writeConfigure();
        });


        let configuresActionRemove = new Gio.SimpleAction({
            name: "remove",
            parameter_type: variantTypeU32,
        });
        configuresActionRemove.connect("activate", (_action, param) => {
            let index = param.get_uint32();
            this._configures.splice(index, 1);
            this.writeConfigure();
        });


        let configuresActionMoveUp = new Gio.SimpleAction({
            name: "move_up",
            parameter_type: variantTypeU32,
        });
        configuresActionMoveUp.connect("activate", (_action, param) => {
            let index = param.get_uint32();
            let [configure] = this._configures.splice(index, 1);
            this._configures.splice(index - 1, 0, configure);
            this.writeConfigure();
        });


        let configuresActionMoveDown = new Gio.SimpleAction({
            name: "move_down",
            parameter_type: variantTypeU32,
        });
        configuresActionMoveDown.connect("activate", (_action, param) => {
            let index = param.get_uint32();
            let [configure] = this._configures.splice(index, 1);
            this._configures.splice(index + 1, 0, configure);
            this.writeConfigure();
        });


        let configuresActionNew = new Gio.SimpleAction({ name: "new" });
        configuresActionNew.connect("activate", (_action) => {
            this.newConfigure(window);
        });


        let configuresActionReset = new Gio.SimpleAction({ name: "reset" });
        configuresActionReset.connect("activate", (_action) => {
            this.resetConfigure(window);
        });

        configuresActionGroup.add_action(configuresActionEdit);
        configuresActionGroup.add_action(configuresActionCopy);
        configuresActionGroup.add_action(configuresActionRemove);
        configuresActionGroup.add_action(configuresActionMoveUp);
        configuresActionGroup.add_action(configuresActionMoveDown);
        configuresActionGroup.add_action(configuresActionNew);
        configuresActionGroup.add_action(configuresActionReset);

        this.page.insert_action_group("configures", configuresActionGroup);

        this.setupConfiguresList(window);

        this._settings.connect("changed", (settings, key) => {
            this.onSettingsChanged(settings, key, window);
        });
    }

    /**
     * Setup configure list with given configures.
     */
    setupConfiguresList(window) {
        for (let row of this._configureRows) {
            this._configureGroup.remove(row);
        }

        this._configureRows = this._configures.map ((configure, index) => {
            let id = configure[0];

            // Pre-builder : Menu
            let menu = new Gio.Menu();
            menu.append(gettext("Copy"), `configures.copy(uint32 ${index})`);
            menu.append(gettext("Remove"), `configures.remove(uint32 ${index})`);

            if (index > 0) {
                menu.append(gettext("Move Up"), `configures.move_up(uint32 ${index})`);
            }
            if (index < this._configures.length - 1) {
                menu.append(gettext("Move Down"), `configures.move_down(uint32 ${index})`);
            }

            // Builder
            let builder = Gtk.Builder.new_from_file(`${this._path}/ui/preferencePipelineConfigureRow.ui`);
            let row = builder.get_object("row");
            let edit_button = builder.get_object("edit_button");
            let menu_button = builder.get_object("menu_button");

            row.title = id;
            edit_button.action_target = new GLib.Variant("u", index);
            menu_button.menu_model = menu

            this._configureGroup.add(row);
            return row;
        }, this);
    }

    /**
     * Edit configure at index.
     *
     * @param {Adw.Window} window Window to show configure window.
     * @param {number} index Index to edit.
     */
    editConfigure(window, index) {
        this.presentConfigureDialog(window, this._configures[index], (configure) => {
            this._configures[index] = configure;
            this.writeConfigure();
        });
    }


    /**
     * New configure.
     *
     * @param {Adw.Window} window Window to show configure window.
     */
    newConfigure(window) {
        this.presentConfigureDialog(window, null, (configure) => {
            this._configures.splice(0, 0, configure);
            this.writeConfigure();
        });
    }

    /**
     * Reset configure.
     *
     * @param {Adw.Window} window Window to show configure window.
     */
     resetConfigure(window) {
        this._dialogAlertReset.choose(window, null, (src, res) => {
            let response = src.choose_finish(res);
            if (response == "yes") this._settings.reset(KEY_PIPELINE_CONFIGURES);
        });
     }

    /**
     * Present a configure dialog, to input configure.
     *
     * @param {Adw.Window} window Window to show configure window.
     * @param {?Configure} configure Initial configure to show, or null for empty.
     * @param {(configure: Configure) => void} onAccepted Callback to call on accepted.
     */
    presentConfigureDialog(window, configure, onAccepted) {
        let builder = Gtk.Builder.new_from_file(`${this._path}/ui/preferencePipelineConfigureDialog.ui`);
        let dialog = builder.get_object("dialog");
        let id_row = builder.get_object("id_row");
        let video_prep_row = builder.get_object("video_prep_row");
        let video_prep_resize_row = builder.get_object("video_prep_resize_row");
        let video_row = builder.get_object("video_row");
        let audio_row = builder.get_object("audio_row");
        let muxer_row = builder.get_object("muxer_row");
        let extension_row = builder.get_object("extension_row");

        if (configure) {
            let [id, prep, prepResize, video, audio, muxer, ext] = configure;
            id_row.text = id;
            video_prep_row.text = prep;
            video_prep_resize_row.text = prepResize;
            video_row.text = video;
            audio_row.text = audio;
            muxer_row.text = muxer;
            extension_row.text = ext;
        }

        dialog.choose(window, null, (src, res) => {
            let result = src.choose_finish(res);
            if (result == "yes") {
                let configure = [
                    id_row.text,
                    video_prep_row.text,
                    video_prep_resize_row.text,
                    video_row.text,
                    audio_row.text,
                    muxer_row.text,
                    extension_row.text,
                ];
                onAccepted(configure);
            }
        });
    }

    /**
     * Write configure to settings.
     */
    writeConfigure() {
        let variant = new GLib.Variant("a(sssssss)", this._configures);
        this._settings.set_value(KEY_PIPELINE_CONFIGURES, variant);
        this._settings.apply();
    }


    /**
     * @param {Gio.Settings} settings
     * @param {string} key
     */
    onSettingsChanged(settings, key, window) {
        switch (key) {
            case KEY_PIPELINE_CONFIGURES:
                this._configures = settings.get_value(KEY_PIPELINE_CONFIGURES).recursiveUnpack();
                this.setupConfiguresList(window);
                break;
        }
    }
}

