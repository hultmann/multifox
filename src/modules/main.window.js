/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var WindowWatcher = {

  init: function() {
    Services.obs.addObserver(this, "chrome-document-global-created", false);
  },


  uninit: function() {
    Services.obs.removeObserver(this, "chrome-document-global-created");
  },


  observe: function(win, topic, data) {
    if (isTopWindow(win)) { // this works also as a workaround for bug 795961
      win.addEventListener("DOMContentLoaded", WindowWatcher._onLoad, false);
    }
  },


  _onLoad: function(evt) {
    var win = evt.currentTarget;
    console.assert(win === evt.target.defaultView, "bubbled DOMContentLoaded event " + win.location.href);
    win.removeEventListener("DOMContentLoaded", WindowWatcher._onLoad, false);

    switch (win.location.href) {
      case "chrome://browser/content/browser.xul":
        //if ((win.document instanceof Ci.nsIDOMDocument) === false) {
        MainWindow.initWindow(win);
        break;
      case "chrome://mozapps/content/extensions/about.xul":
        // make "About" menuitem open about:multifox tab
        var ns = util.loadSubScript("${PATH_CONTENT}/overlays.js");
        ns.AboutOverlay.add(win);
        break;
    }
  }

};



var MainWindow = {

  initAll: function() {
    var enumWin = UIUtils.getWindowEnumerator();
    while (enumWin.hasMoreElements()) {
      this.initWindow(enumWin.getNext());
    }
  },


  uninitAll: function() {
    var enumWin = UIUtils.getWindowEnumerator();
    while (enumWin.hasMoreElements()) {
      this.uninitWindow(enumWin.getNext(), "disabling extension");
    }
  },


  initWindow: function(win) {
    ChromeRelatedEvents.initWindow(win);
    ContentRelatedEvents.initWindow(win);

    // debug key
    var doc = win.document;
    var key = doc.getElementById("mainKeyset").appendChild(doc.createElement("key"));
    key.setAttribute("id", "multifox2-debug-key");
    key.setAttribute("keycode", "VK_F4");
    key.setAttribute("oncommand", "(function(){})()"); // it doesn't work without that
    key.addEventListener("command", function() {
      console.log("\n" + DebugWinMap.toString() + "\n\n\n" +

                  "\n-----------\nOuter Windows, len", Object.keys(WinMap._outer).length, "\n",
                  JSON.stringify(WinMap._outer, null, 2),

                  "\n=========================\nInner Windows, len", Object.keys(WinMap._inner).length, "\n",
                  JSON.stringify(WinMap._inner, null, 2));
    }, false);
  },


  uninitWindow: function(win, reason) {
    var key = win.document.getElementById("multifox2-debug-key");
    key.parentNode.removeChild(key);

    ChromeRelatedEvents.uninitWindow(win);
    ContentRelatedEvents.uninitWindow(win, reason);
    if (reason === "closing window") {
      return;
    }
    // remove icon
    var container = getIconContainer(win.document);
    if (container !== null) {
      container.parentNode.removeChild(container);
    }
  }
};
