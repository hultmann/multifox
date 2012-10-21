/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ChromeRelatedEvents = {

  initWindow: function(chromeWin) {
    // hide icon during toolbar customization
    chromeWin.addEventListener("beforecustomization", this, false);
    chromeWin.addEventListener("aftercustomization", this, false);

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true.
    // But they are called if event listener is an anonymous function.
    chromeWin.addEventListener("unload", this, false);
    chromeWin.addEventListener("activate", this, false);

    var container = UIUtils.getTabStripContainer(chromeWin);
    container.addEventListener("TabSelect", this, false);
    container.addEventListener("SSTabRestoring", this, false);
  },


  uninitWindow: function(chromeWin) {
    chromeWin.removeEventListener("beforecustomization", this, false);
    chromeWin.removeEventListener("aftercustomization", this, false);
    chromeWin.removeEventListener("unload", this, false);
    chromeWin.removeEventListener("activate", this, false);

    var container = UIUtils.getTabStripContainer(chromeWin);
    container.removeEventListener("TabSelect", this, false);
    container.removeEventListener("SSTabRestoring", this, false);
  },


  handleEvent: function(evt) {
    try {
      this[evt.type](evt);
    } catch (ex) {
      Cu.reportError(ex);
      throw new Error("ChromeRelatedEvents exception. " + evt.type + "\n" + ex.toString()); // TODO console.error
    }
  },


  unload: function(evt) {
    var win = evt.currentTarget;
    MainWindow.uninitWindow(win, "closing window");
  },


  activate: function(evt) {
    var win = evt.currentTarget;
    var tab = UIUtils.getSelectedTab(win);
    LoginDB.setTabAsDefaultUser(tab); // TODO mark all tlds as default
    //LoginDB._ensureValid(); // BUG workaround to display welcome icon
    if (m_welcomeMode) {
      updateUIAsync(tab, true);
    }
  },


  TabSelect: function(evt) {
    var tab = evt.originalTarget;
    updateUIAsync(tab, true);
  },


  SSTabRestoring: function(evt) {
    var tab = evt.originalTarget;
    WinMap.restoreTabDefaultUsers(tab);
  },


  beforecustomization: function(evt) {
    var toolbox = evt.target;
    removeUI(toolbox.ownerDocument);
  },


  aftercustomization: function(evt) {
    var toolbox = evt.target;
    var tab = UIUtils.getSelectedTab(toolbox.ownerDocument.defaultView);
    updateUIAsync(tab, true);
  }

};
