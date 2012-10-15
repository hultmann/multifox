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
    if (tab.hasAttribute("multifox-tab-logins") === false) {
      return;
    }
    console.log("SSTabRestoring", tab.getAttribute("multifox-tab-logins"));

    var tabLogins;
    try {
      // TODO delay until tab is actually loaded (@ getUserFromDocument?)
      tabLogins = JSON.parse(tab.getAttribute("multifox-tab-logins"));
    } catch (ex) {
      console.warn("SSTabRestoring - buggy json: " + tab.getAttribute("multifox-tab-logins"));
      return;
    }

    if (("firstParty" in tabLogins) === false) {
      return;
    }

    var logins = tabLogins.firstParty;
    var tabId = getIdFromTab(tab);
    for (var tld in logins) {
      var obj = logins[tld];
      var userId = new UserId(obj.encodedUser, obj.encodedTld);
      var docUser = new DocumentUser(userId, tld, tabId);
      WinMap.setUserForTab(docUser, tabId);
    }
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
