/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var AboutOverlay = {
  add: function(win) {
    if (win.arguments[0].id !== "${EXT_ID}") {
      return;
    }

    var browserWin = UIUtils.getMostRecentWindow();
    if (browserWin === null) {
      return;
    }

    var uri = Services.io.newURI("about:multifox", null, null);
    var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
    browserWin.browserDOMWindow.openURI(uri, null, where, null);

    win.close();

    // hide window to avoid flickering
    var root = win.document.documentElement;
    root.setAttribute("hidechrome", "true");
    root.setAttribute("hidden", "true");
  }
};
