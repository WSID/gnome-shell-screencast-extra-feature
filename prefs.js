/* prefs.js
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

import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import * as PartGeneral from "./prefsParts/partgeneral.js";
import * as PartPipeline from "./prefsParts/partpipeline.js";

import {ExtensionPreferences, gettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ScreencastExtraFeaturePreferences extends ExtensionPreferences {
    /**
     * @param {Adw.PreferencesWindow} window A window.
     */
    fillPreferencesWindow(window) {
        this._settings = this.getSettings("org.gnome.shell.extensions.screencastExtraFeature");
        
        // Register icon before creating preference parts.

        let display = window.get_display();
        let icon_theme = Gtk.IconTheme.get_for_display(display);
        icon_theme.add_search_path(`${this.path}/icons`);

        this._partGeneral = new PartGeneral.PartGeneral(window, this.path, this._settings);
        this._partPipeline = new PartPipeline.PartPipeline(window, this.path, this._settings);
        
        window.add(this._partPipeline.page);
        window.connect("close-request", this.onWindowClose.bind(this));
    }

    /**
     * @param window {Gtk.Window} A preference window.
     */
    onWindowClose(window) {
        if (this._partPipeline) {
            this._partPipeline.destroy();
        }

        if (this._partGeneral) {
            this._partGeneral.destroy();
        }

        this._partGeneral = null;
        this._partPipeline = null;

        this._settings = null;
    }
}
