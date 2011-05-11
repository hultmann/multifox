/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

const PlacesOverlay = {
  add: function(win) {
    var popup = win.document.getElementById("placesContext");
    popup.addEventListener("popupshowing", function(evt) {
      var ns = {};
      Components.utils.import("${PATH_MODULE}/menus.js", ns);
      ns.menuShowing(evt);
    }, false);
  }
};


const AboutOverlay = {
  add: function(win) {
    if (win.arguments[0].id !== "${EXT_ID}") {
      return;
    }

    var Cc = Components.classes;
    var Ci = Components.interfaces;
    Components.utils.import("resource://gre/modules/Services.jsm");

    var browserWin = Services.wm.getMostRecentWindow("navigator:browser");
    if (browserWin === null) {
      return;
    }

    var uri = Services.io.newURI("about:multifox", null, null);
    var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
    browserWin.browserDOMWindow.openURI(uri, null, where, null);

    win.setTimeout(win.close, 0);

    // hide window to avoid flicker
    var root = win.document.documentElement;
    root.setAttribute("hidechrome", "true");
    root.setAttribute("hidden", "true");
  }
};
