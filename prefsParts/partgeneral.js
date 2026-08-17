/* partgeneral.js
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
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import {gettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as ArrayListStore from "./arrayliststore.js";

const KEY_FRAMERATES = "framerates";
const KEY_DEFAULT_FRAMERATE = "default-framerate";

const KEY_DOWNSIZE_RATIOS = "downsize-ratios";
const KEY_DEFAULT_DOWNSIZE_RATIOS = "default-downsize-ratio";


/**
 * Shows a value into string.
 *
 * @callback ShowFunction
 * @param {number} value A value to show.
 * @return {string} A result string.
 */

const ListDefaultGroup = GObject.registerClass(
    {
        GTypeName: "ListDefaultGroup",
        Properties: {
            "add-adjustment": GObject.param_spec_object(
                "add-adjustment",
                "Add Adjustment",
                "Adjustment for adding new item.",
                Gtk.Adjustment,
                GObject.ParamFlags.READWRITE
            ),
            "default-item": GObject.param_spec_double(
                "default-item",
                "Default Item",
                "Default item to be selected at first.",
                -100000,
                100000,
                0,
                GObject.ParamFlags.READWRITE,
            ),
        },
        Signals: {
            "reset": {}
        }
    },
    class ListDefaultGroup extends Adw.PreferencesGroup {
        vfunc_constructed () {
            this.model = new ArrayListStore.ArrayListStore();

            // The box.

            this.box = new Gtk.ListBox({
                activate_on_single_click: false,
                css_classes: ["boxed-list"],
            });

            this.box_on_activate = this.box.connect(
                "row-activated",
                (_, row) => {
                    this.default_item = row.value;
                }
            );

            this.box.bind_model(this.model, (item) => this.makeRow(item.value));

            this.placeholder = new Gtk.Label({
                label: gettext("No item in list. Will be reset to default if empty."),
                margin_bottom: 32,
                margin_top: 32,
            })

            this.box.set_placeholder(this.placeholder);

            this.add(this.box);

            // The header suffix.

            this.setupAddButton();
            this.setupResetButton();

            const header_suffix = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
            });

            header_suffix.append(this.add_button);
            header_suffix.append(this.reset_button);

            this.header_suffix = header_suffix;
        }

        setupAddButton() {
            // Popover
            this.add_box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                css_classes: ["linked"],
            });

            this.add_spin = new Gtk.SpinButton({
                width_chars: 8,
            });

            this.add_accept = new Gtk.Button({
                label: gettext("Add"),
                css_classes: ["suggested-action"]
            });
            this.model.connect(
                "items-changed",
                (..._) => this.updateUIAddButton()
            );

            this.add_spin_value_changed = this.add_spin.connect(
                "value-changed",
                (_) => this.updateUIAddButton(),
            );

            this.add_spin_activate = this.add_spin.connect(
                "activate",
                (_) => {
                    const value = this.add_spin.value;
                    if (! this.model.includes(value)) {
                        if (this.model.get_n_items() === 0) {
                            this.default_item = value;
                        }
                        this.add_accept.sensitive = false;
                        this.model.insert_sorted(value);
                        this.add_popover.popdown();
                    }
                }
            )

            this.add_spin_output = this.add_spin.connect(
                "output",
                (spin) => {
                    if (this._show_func) {
                        spin.text = this._show_func(spin.value);
                        return true;
                    }
                    return false;
                }
            );

            this.add_accept_clicked = this.add_accept.connect(
                "clicked",
                (_) => {
                    const value = this.add_spin.value;
                    if (! this.model.includes(value)) {
                        if (this.model.get_n_items() === 0) {
                            this.default_item = value;
                        }
                        this.add_accept.sensitive = false;
                        this.model.insert_sorted(value);
                        this.add_popover.popdown();
                    }
                }
            );

            this.add_box.append(this.add_spin);
            this.add_box.append(this.add_accept);

            this.add_popover = new Gtk.Popover({
                child: this.add_box,
            });

            this.add_button = new Gtk.MenuButton({
                css_classes: ["flat"],
                icon_name: "list-add-symbolic",
                popover: this.add_popover,
            });
        }

        setupResetButton() {
            this.reset_dialog = new Adw.AlertDialog({
                heading: gettext("Reset {}").replace("{}", this.title),
                body: gettext("This cannot be reverted."),
                default_response: "cancel",
            });

            this.reset_dialog.add_response("cancel", gettext("Cancel"));
            this.reset_dialog.add_response("ok", gettext("Ok"));
            this.reset_dialog.set_response_appearance("ok", Adw.ResponseAppearance.DESTRUCTIVE);

            this.reset_dialog_response = this.reset_dialog.connect("response", (_, resp) => {
                if (resp === "ok") this.emit("reset");
            });

            this.connect("notify::title", (_object, _pspec) => {
                this.reset_dialog.heading =  gettext("Reset {}").replace("{}", this.title);
            });

            this.reset_button = new Gtk.Button({
                css_classes: ["flat", "destructive-action"],
                icon_name: "arrow-circular-top-right-symbolic",
            });

            this.reset_button_clicked = this.reset_button.connect("clicked", (button) => {
                this.reset_dialog.present(button);
            });
        }

        get add_adjustment() {
            return this.add_spin.adjustment;
        }

        set add_adjustment(v) {
            this.add_spin.adjustment = v;
        }

        get default_item() {
            return this._default_item;
        }

        set default_item(v) {
            this._default_item = v;
            this.notify("default-item");
        }

        get show_func() {
            return this._show_func;
        }

        set show_func(v) {
            const n = this.model.get_n_items();
            for (var i = 0; i < n; i++) {
                const value = this.model.at(i);
                const row = this.box.get_row_at_index(i);

                if (v) {
                    row.title = v(value);
                } else {
                    row.title = value.toString();
                }
            }

            this._show_func = v;
        }

        updateUIAddButton() {
            this.add_accept.sensitive = ! (this.model.includes(this.add_spin.value));
        }

        makeRow(value) {
            /** @type {string} */
            var text = null;
            if (this._show_func) {
                text = this._show_func(value);
            } else {
                text = value.toString();
            }

            const row = new Adw.ActionRow({
                title: text,
                activatable: true,
            });

            row.remove_button = new Gtk.Button({
                icon_name: "list-remove-symbolic",
                css_classes: ["flat"]
            });
            row.remove_button_clicked = row.remove_button.connect("clicked", (_) => {
                const i = this.model.indexOf(value);
                if (i !== -1) {
                    this.model.splice(i, 1);
                    if (this.default_item === value) {
                        const n = this.model.get_n_items();

                        if (i < n) {
                            this.default_item = this.model.at(i);
                        } else if ((0 <= i - 1) && (i - 1 < n)) {
                            this.default_item = this.model.at(i - 1);
                        }
                    }
                }
            });

            row.default_mark = new Gtk.Image({
                icon_name: "check-round-outline-symbolic",
                visible: (this.default_item === value)
            });

            row.add_suffix(row.default_mark);
            row.add_suffix(row.remove_button);


            row.notify_default_item = this.connect(
                "notify::default-item",
                (_obj, _param) => {
                    row.default_mark.visible = (this._default_item === value);
                }
            );

            row.value = value;
            return row;
        }
    }
);

/**
 * Part General
 *
 * Handles General Options.
 */
export class PartGeneral {
    constructor(window, path, settings) {
        this._path = path;
        this._settings = settings;

        let builder = new Gtk.Builder();
        builder.add_from_file(`${path}/ui/preferenceGeneral.ui`);

        this.page = builder.get_object("page");
        this.framerates_group = builder.get_object("framerates_group");
        this.downsize_ratios_group = builder.get_object("downsize_ratios_group");

        this.framerates_group.show_func = (v) => `${v} FPS`;
        this.downsize_ratios_group.show_func = (v) => `${v} %`;

        this.framerates_group.connect("reset", (_) => {
            this._settings.reset(KEY_FRAMERATES);
            this._settings.reset(KEY_DEFAULT_FRAMERATE);
        });

        this.downsize_ratios_group.connect("reset", (_) => {
            this._settings.reset(KEY_DOWNSIZE_RATIOS);
            this._settings.reset(KEY_DEFAULT_DOWNSIZE_RATIOS);
        });

        window.add(this.page);

        this._settings.bind(
            KEY_DEFAULT_FRAMERATE,
            this.framerates_group, "default-item",
            Gio.SettingsBindFlags.DEFAULT);

        this._settings.bind(
            KEY_DEFAULT_DOWNSIZE_RATIOS,
            this.downsize_ratios_group, "default-item",
            Gio.SettingsBindFlags.DEFAULT);

        this.framerates_group_model_on_items_changed =
            this.framerates_group.model.connect(
                "items-changed",
                this.onFrameratesChanged.bind(this)
            );

        this.downsize_ratios_group_model_on_items_changed =
            this.downsize_ratios_group.model.connect(
                "items-changed",
                this.onDownsizeRatiosChanged.bind(this)
            );

        this._settingsChanged = this._settings.connect(
            "changed",
            this.onSettingsChanged.bind(this),
        );

        this.updateFramerates();
        this.updateDownsizeRatios();
    }

    destroy() {
        if (this.framerates_group.model.length === 0) {
            this._settings.reset(KEY_FRAMERATES);
            this._settings.reset(KEY_DEFAULT_FRAMERATE);
        }

        if (this.downsize_ratios_group.model.length === 0) {
            this._settings.reset(KEY_DOWNSIZE_RATIOS);
            this._settings.reset(KEY_DEFAULT_DOWNSIZE_RATIOS);
        }

        if (this._settingsChanged) {
            this._settings.disconnect(this._settingsChanged);
            this._settingsChanged = null;
        }

        if (this.downsize_ratios_group_model_on_items_changed) {
            this.downsize_ratios_group.model.disconnect(
                this.downsize_ratios_group_model_on_items_changed
            );
            this.downsize_ratios_group_model_on_items_changed = null;
        }

        if (this.framerates_group_model_on_items_changed) {
            this.framerates_group.model.disconnect(
                this.framerates_group_model_on_items_changed
            );
            this.framerates_group_model_on_items_changed = null;
        }

        this.downsize_ratios_group = null;
        this.framerates_group = null;
        this.page = null;
        this._settings = null;
        this._path = null;
    }

    updateFramerates() {
        GObject.signal_handler_block(
            this.framerates_group.model,
            this.framerates_group_model_on_items_changed
        );

        const n_items = this.framerates_group.model.get_n_items();
        this.framerates_group.model.splice(
            0,
            n_items,
            ...this._settings.get_value(KEY_FRAMERATES).recursiveUnpack()
        );

        GObject.signal_handler_unblock(
            this.framerates_group.model,
            this.framerates_group_model_on_items_changed
        );
    }

    updateDownsizeRatios() {
        GObject.signal_handler_block(
            this.downsize_ratios_group.model,
            this.downsize_ratios_group_model_on_items_changed
        );

        const n_items = this.downsize_ratios_group.model.get_n_items();
        const values = this._settings.get_value(KEY_DOWNSIZE_RATIOS).recursiveUnpack();
        this.downsize_ratios_group.model.splice(0, n_items, ...values);

        GObject.signal_handler_unblock(
            this.downsize_ratios_group.model,
            this.downsize_ratios_group_model_on_items_changed
        );
    }

    onFrameratesChanged(..._) {
        GObject.signal_handler_block(this._settings, this._settingsChanged);
        this._settings.set_value(
            KEY_FRAMERATES,
            new GLib.Variant("aq", Array.from(this.framerates_group.model))
        );
        GObject.signal_handler_unblock(this._settings, this._settingsChanged);
    }

    onDownsizeRatiosChanged(..._) {
        GObject.signal_handler_block(this._settings, this._settingsChanged);
        this._settings.set_value(
            KEY_DOWNSIZE_RATIOS,
            new GLib.Variant("ad", Array.from(this.downsize_ratios_group.model))
        );
        GObject.signal_handler_unblock(this._settings, this._settingsChanged);
    }

    onSettingsChanged(_settings, key) {
        switch(key) {
            case KEY_FRAMERATES:
                this.updateFramerates();
                break;

            case KEY_DOWNSIZE_RATIOS:
                this.updateDownsizeRatios();
                break;
        }
    }
}



