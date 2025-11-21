/* partbase.js
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

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';


/**
 * A base class for part of this extension.
 */
export class PartBase {
    /**
     * Function for teardown.
     */
    destroy() {
    }
}

/**
 * A base class for part, that adds UI on here.
 */
export class PartUI extends PartBase {

    /**
     * Construct part with screenshot UI.
     *
     * @param screenshotUI a screenshot UI.
     */
    constructor(screenshotUI) {
        super();

        this._castModeSelected = false;

        this.screenshotUI = screenshotUI;
        this.shotButton = this.screenshotUI._shotButton;

        this.shotButtonNotifyChecked = this.shotButton.connect (
            "notify::checked",
            (_object, _pspec) => {
                this._castModeSelected = !this.shotButton.checked;
                this.onCastModeSelected(this._castModeSelected);
            }
        );
    }

    /** @override */
    destroy() {
        if (this.shotButton && this.shotButtonNotifyChecked) {
            this.shotButton.disconnect(this.shotButtonNotifyChecked);
        }

        this.shotButton = null;
        this.screenshotUI = null;

        this._castModeSelected = false;

        super.destroy();
    }

    /**
     * Called when the cast mode selection is changed.
     *
     * @param {boolean} selected Whether the cast mode is selected.
     */
    onCastModeSelected(selected) {
        // Empty.
    }

    /**
     * Get cast mode selected.
     *
     * @returns {boolean} Whether the cast mode is selected.
     */
    get castModeSelected() {
        return this._castModeSelected;
    }
}

/**
 * A base class for popup selection.
 *
 * @template T Type of selectable item.
 */
export class PartPopupSelect extends PartUI {
    /**
     * Construct part with screenshot UI and items.
     *
     * @param screenshotUI a sceenshot UI.
     * @param {T[]} items a list of selectable items.
     * @param {T} selectedItem Initially selected item.
     */
    constructor(screenshotUI, items, selectedItem) {
        super(screenshotUI);

        this._selectedItem = selectedItem;

        this.showPointerButtonContainer = this.screenshotUI._showPointerButtonContainer;

        // Button
        this.button = new St.Button({
            style_class: 'screenshot-ui-show-pointer-button',
            label: this.makeLabel(this._selectedItem),
            visible: false,
        });
        this.showPointerButtonContainer.insert_child_at_index(this.button, 0);

        // Popup menu.
        this.popupMenu = new PopupMenu.PopupMenu(
            this.button,
            0.5,
            St.Side.BOTTOM
        );
        this.popupMenu.actor.visible = false;
        this.screenshotUI.add_child(this.popupMenu.actor);

        for (let item of items) {
            let label = this.makeLabel(item);
            this.popupMenu.addAction (
                label,
                () => {
                    this._selectedItem = item;
                    this.button.label = label;
                }
            )
        }

        this.buttonClicked = this.button.connect(
            "clicked",
            (_object, _button) => this.popupMenu.toggle()
        );
    }

    /** @override */
    destroy() {
        if (this.popupMenu) {
            this.screenshotUI.remove_child(this.popupMenu.actor);
            this.popupMenu.destroy();
            this.popupMenu = null;
        }

        if (this.showPointerButtonContainer) {
            if (this.button) {
                if (this.buttonClicked) {
                    this.button.disconnect(this.buttonClicked);
                    this.buttonClicked = null;
                }

                this.showPointerButtonContainer.remove_child(this.button);
                this.button.destroy();
                this.button = null;
            }

            this.showPointerButtonContainer = null;
        }

        this._selectedItem = null;

        super.destroy();
    }

    /** @override */
    onCastModeSelected(selected) {
        if (! selected) {
            this.popupMenu.close();
        }
        this.button.visible = selected;
    }

    /**
     * Make label from the item.
     *
     * @abstract
     * @param {T} item Item to label.
     * @returns {string} The label for the item.
     */
    makeLabel(item) {
        throw new Error("Not Implemented");
    }

    /**
     * Get selected item.
     *
     * @returns {T} selected item.
     */
    get selectedItem () {
        return this._selectedItem;
    }
}
