/* partpref.js
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

import Gio from "gi://Gio"; 
import St from "gi://St";

import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

import * as PartBase from "./partbase.js";

/**
 * Adds A button for preferences.
 */
export class PartPref extends PartBase.PartUI {
    constructor(screenshotUI, extension) {
        super(screenshotUI);
        this.extension = extension;
        
        this.showPointerButtonContainer = this.screenshotUI._showPointerButtonContainer;
        
        let iconsDir = extension.dir.get_child("icons");

        // Button
        this.button = new St.Button({
            style_class: 'screenshot-ui-show-pointer-button',
            visible: false,
        });
        this.buttonIcon = new St.Icon({
            gicon: new Gio.FileIcon({
                file: iconsDir.get_child("settings-symbolic.svg")
            })
        });
        
        this.button.add_child(this.buttonIcon);
        this.showPointerButtonContainer.insert_child_at_index(this.button, 0);
        
        
        // Tooltip
        this.tooltip = new Screenshot.Tooltip(
          this.button,
          {
            style_class: 'screenshot-ui-tooltip',
            text: gettext("Screencast extra feature preferences"),
            visible: false
          }
        );
        
        this.screenshotUI.add_child(this.tooltip);

        this.buttonClicked = this.button.connect(
            "clicked",
            (_object, _button) => {
                this.screenshotUI.close();
                this.extension.openPreferences();
            }
        );
    }

    /** @override */
    destroy() {
        if (this.showPointerButtonContainer) {
            if (this.button) {
            
                if (this.buttonClicked) {
                    this.button.disconnect(this.buttonClicked);
                    this.buttonClicked = null;
                }
                
                if (this.buttonIcon) {
                    this.button.remove_child(this.buttonIcon);
                    this.buttonIcon.destroy();
                    this.buttonIcon = null;
                }

                this.showPointerButtonContainer.remove_child(this.button);
                this.button.destroy();
                this.button = null;
            }

            this.showPointerButtonContainer = null;
        }

        this.extension = null;
        super.destroy();
    }

    /** @override */
    onCastModeSelected(selected) {
        this.button.visible = selected;
    }
}
