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

import Adw from "gi://Adw";

import {ExtensionPreferences, gettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ScreencastExtraFeaturePreferences extends ExtensionPreferences {
    /**
     * @param {Adw.PreferencesWindow} window A window.
     */
    fillPreferencesWindow(window) {
        let generalPage = new Adw.PreferencesPage({
            title: gettext("General")
        });
        
        window.add(generalPage);
    }
} 
