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
 * Portions created by the Initial Developer are Copyright (C) 2009
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
