/* partadjust.js
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
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";

// Shell import
import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

// Extension imports
import * as PartBase from "./partbase.js"


// Constants
const KEY_FRAMERATES = "framerates";
const KEY_DEFAULT_FRAMERATE = "default-framerate";

const KEY_DOWNSIZE_RATIOS = "downsize-ratios";
const KEY_DEFAULT_DOWNSIZE_RATIOS = "default-downsize-ratio";



/**
 * A sub menu item for selection.
 *
 * @template T Type of selectable item.
 */
const SelectSubMenuMenuItem = GObject.registerClass(
class SelectSubMenuMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    /**
     * @param {string} title
     * @param {T[]} items a list of selectable items.
     * @param {T} selectedItem Initially selected item.
     * @param {((T) => string)?} itemLabelling Labelling of each item, or null for toString().
     */
    _init(title, items, selectedItem, itemLabelling) {
        this._title = title;

        this._selectedItem = selectedItem;
        if (itemLabelling)
            this._itemLabelling = itemLabelling;
        else
            this._itemLabelling = (t) => t.toString();

        let labelText = `${title}: ${this._itemLabelling(this._selectedItem)}`;
        super._init(labelText, true);

        for (let item of items) {
            let itemLabel = this._itemLabelling(item);
            let itemTitle = `${title}: ${itemLabel}`;
            this.menu.addAction(
                itemLabel,
                () => {
                    this._selectedItem = item;
                    this.label.text = itemTitle;
                }
            );
        }

        this.connect("destroy", () => {
            this._itemLabelling = null;
            this._selectedItem = null;
            this._title = null;
        });
    }

    /**
     * Selected Item.
     *
     * @type {T}
     */
    get selectedItem () {
        return this._selectedItem;
    }

    set selectedItem (value) {
        this._selectedItem = value;
        this.label.text = `${this._title}: ${this._itemLabelling(value)}`;
    }
});

/**
 * Extension part for screen cast options.
 */
export class PartAdjust extends PartBase.PartUI {
    constructor(screenshotUI, extension) {
        super(screenshotUI);
        this.extension = extension;

        this._iconsDir = extension.dir.get_child("icons");

        // Reference from Main UI.
        this._showPointerButtonContainer = this.screenshotUI._showPointerButtonContainer;

        // Button UI.
        this._button = new St.Button({
            style_class: "screenshot-ui-show-pointer-button",
            visible: false
        });

        this._buttonIcon = new St.Icon({
            gicon: new Gio.FileIcon({
                file: this._iconsDir.get_child("controls-symbolic.svg")
            })
        });

        this._button.add_child(this._buttonIcon);
        this._showPointerButtonContainer.insert_child_at_index(this._button, 0);


        // Tooltip UI.
        this._buttonTooltip = new Screenshot.Tooltip(
            this._button,
            {
                style_class: 'screenshot-ui-tooltip',
                text: gettext("Additional Video Options"),
                visible: false
            }
        );
        this.screenshotUI.add_child(this._buttonTooltip);


        // UI Event handling
        this._buttonClicked = this._button.connect(
            "clicked",
            (_object, _button) => this._buttonPopupMenu.toggle()
        );


        // Settings
        this._settings = extension.getSettings("org.gnome.shell.extensions.screencastExtraFeature");
        this._settings_changed = this._settings.connect(
            "changed",
            this.onSettingsChanged.bind(this));

        // submenu
        this.createPopupMenu();
    }

    /** @override */
    destroy() {
        if (this._settings) {
            if (this._settings_changed) {
              this._settings.disconnect(this._settings_changed)
            }
            this._settings = null;
        }

        if (this._buttonClicked) {
            this._button.disconnect(this._buttonClicked);
            this._buttonClicked = null;
        }

        if (this.screenshotUI) {
            if (this._buttonTooltip) {
                this.screenshotUI.remove_child(this._buttonTooltip);
                this._buttonTooltip.destroy();
                this._buttonTooltip = null;
            }
            this.destroyPopupMenu();
        }

        if (this._showPointerButtonContainer) {
            if (this._button) {
                if (this._buttonIcon) {
                    this._button.remove_child(this._buttonIcon);
                    this._buttonIcon.destroy();
                    this._buttonIcon = null;
                }
                this._showPointerButtonContainer.remove_child(this._button);
                this._button.destroy();
                this._button = null;
            }

            this._showPointerButtonContainer = null;
        }

        this._iconsDir = null;
        this.extension = null;
        super.destroy();
    }

    createPopupMenu() {
        this._buttonPopupMenu = new PopupMenu.PopupMenu(this._button, 0.5, St.Side.BOTTOM);
        this._buttonPopupMenu.actor.visible = false;
        this.screenshotUI.add_child(this._buttonPopupMenu.actor);

        const framerates =
            this._settings.get_value(KEY_FRAMERATES).recursiveUnpack();
        const default_framerate =
            this._settings.get_value(KEY_DEFAULT_FRAMERATE).unpack();

        this._framerateItem = new SelectSubMenuMenuItem(
            gettext("Framerate"),
            framerates,
            default_framerate,
            (rate) => `${rate} FPS`
        );

        this._buttonPopupMenu.addMenuItem(this._framerateItem, 0);


        const downsize_ratios =
            this._settings.get_value(KEY_DOWNSIZE_RATIOS).recursiveUnpack();
        const default_downsize_ratio =
            this._settings.get_value(KEY_DEFAULT_DOWNSIZE_RATIOS).unpack();

        this._downsizeItem = new SelectSubMenuMenuItem(
            gettext("Downsize"),
            downsize_ratios,
            default_downsize_ratio,
            (ratio) => `${ratio}%`
        );

        this._buttonPopupMenu.addMenuItem(this._downsizeItem, 1);

        this._prefItem = this._buttonPopupMenu.addAction(
            gettext("Screencast extra feature preferences"),
            () => {
                this.screenshotUI.close();
                this.extension.openPreferences();
            },
            new Gio.FileIcon({
                file: this._iconsDir.get_child("settings-symbolic.svg")
            })
        )
    }

    destroyPopupMenu() {
        if (this._buttonPopupMenu) {
            this._buttonPopupMenu.removeAll();

            this._prefItem = null;
            this._downsizeItem = null;
            this._framerateItem = null;

            this.screenshotUI.remove_child(this._buttonPopupMenu.actor);
            this._buttonPopupMenu.destroy();
            this._buttonPopupMenu = null;
        }
    }

    /** @override */
    onCastModeSelected(selected) {
        this._button.visible = selected;
    }

    onSettingsChanged(_settings, key) {
        switch(key) {
            case KEY_FRAMERATES:
            case KEY_DOWNSIZE_RATIOS:
                this.destroyPopupMenu();
                this.createPopupMenu();
                break;
            case KEY_DEFAULT_FRAMERATE:
                this._framerateItem.selectedItem =
                    this._settings
                        .get_value(KEY_DEFAULT_FRAMERATE)
                        .unpack();
                break;
            case KEY_DEFAULT_DOWNSIZE_RATIOS:
                this._downsizeItem.selectedItem =
                    this._settings
                        .get_value(KEY_DEFAULT_DOWNSIZE_RATIOS)
                        .unpack();
                break;
        }
    }

    /**
     * Framerate
     * @type {number}
     * @readonly
     */
    get framerate() {
        return this._framerateItem.selectedItem;
    }

    /**
     * Downsize Ratio
     * @type {number}
     * @readonly
     */
    get downsizeRatio() {
        return this._downsizeItem.selectedItem / 100;
    }
}
