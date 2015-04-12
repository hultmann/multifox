/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var UIUtils = {

  isMainWindow: function(chromeWin) {
    return this._getWindowType(chromeWin) === "navigator:browser";
  },


  isSourceWindow: function(chromeWin) {
    return this._getWindowType(chromeWin) === "navigator:view-source";
  },


  _getWindowType: function(chromeWin) {
    return chromeWin.document.documentElement.getAttribute("windowtype");
  },


  getContentContainer: function(chromeWin) {
    console.assert(this.isMainWindow(chromeWin), "Not a browser window", chromeWin);
    return chromeWin.gBrowser; // <tabbrowser>
  },


  getTabStripContainer: function(chromeWin) {
    console.assert(this.isMainWindow(chromeWin), "Not a browser window", chromeWin);
    return chromeWin.gBrowser.tabContainer; // <tabs>
  },


  getTabList: function(chromeWin) {
    console.assert(this.isMainWindow(chromeWin), "Not a browser window", chromeWin);
    return chromeWin.gBrowser.tabs; // <tab> NodeList
  },


  getBrowserList: function(chromeWin) {
    console.assert(this.isMainWindow(chromeWin), "Not a browser window", chromeWin);
    return chromeWin.gBrowser.browsers; // <browser> Array
  },


  getSelectedTab: function(chromeWin) {
    console.assert(this.isMainWindow(chromeWin), "Not a browser window", chromeWin);
    return chromeWin.gBrowser.selectedTab; // <tab>
  },


  isContentBrowser: function(browser) {
    console.assert(browser !== null, "browser should not be null");
    // edge case: browser (and tab) already removed from DOM
    //            (browser.parentNode === null)
    var tb = browser.ownerDocument.getBindingParent(browser);
    if (tb === null) {
      return false;
    }
    // it works with the new about:newtab preloading (Fx37)
    return tb.localName === "tabbrowser";
  },


  getLinkedTabFromBrowser: function(browser) {
    var win = this.getTopLevelWindow(browser.ownerDocument.defaultView);
    return this.getContentContainer(win).getTabForBrowser(browser);
  },


  findOriginBrowser: function(contentWin) {
    if (contentWin === null) {
      return null;
    }

    var browser = UIUtils.getContainerElement(contentWin);
    if (browser !== null) {
      if (UIUtils.isMainWindow(browser.ownerDocument.defaultView)) {
        return browser;
      }
    }

    // source-view?
    var chromeWin = UIUtils.getTopLevelWindow(contentWin);
    if (chromeWin && UIUtils.isSourceWindow(chromeWin)) {
      var winOpener = chromeWin.opener;
      if (winOpener && UIUtils.isMainWindow(winOpener)) {
        return UIUtils.getSelectedTab(winOpener).linkedBrowser;
      }
    }

    return null;
  },


  getContainerElement: function(contentWin) {
    var browser = UIUtils.getParentBrowser(contentWin);
    if (browser === null) {
      return null;
    }
    // browser.xul has browser elements all over the place
    var t = browser.getAttribute("type");
    return ((t === "content-targetable") || (t === "content-primary"))
           ? browser : null;
  },


  getParentBrowser: function(win) {
    console.assert(win !== null, "getParentBrowser win=null");
    var browser = win.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIWebNavigation)
                     .QueryInterface(Ci.nsIDocShell)
                     .chromeEventHandler;
    if (browser === null) {
      return null;
    }
    if (browser.localName === "browser") {
      return browser;
    }
    // e.g. <iframe> chrome://browser/content/devtools/cssruleview.xhtml
    //console.log("not a browser element", browser.localName, win, win.parent);
    return null;
  },


  getTopLevelWindow: function(win) { // content or chrome windows
    if ((!win) || (!win.QueryInterface)) {
      console.trace("getTopLevelWindow win=" + win);
      return null;
    }

    var topwin = win.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIWebNavigation)
                    .QueryInterface(Ci.nsIDocShellTreeItem)
                    .rootTreeItem
                    .QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindow);

    console.assert(topwin !== null, "getTopLevelWindow null", win);
    console.assert(topwin !== undefined, "getTopLevelWindow undefined", win);
    console.assert(topwin === topwin.top, "getTopLevelWindow should return a top window",
                   UIUtils.getDOMUtils(topwin).currentInnerWindowID, topwin, topwin.top);
    // unwrapped object allows access to gBrowser etc
    return XPCNativeWrapper.unwrap(topwin);
  },


  getDOMUtils: function(win) {
    console.assert(typeof win === "object", "win should be an object", win);
    return win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  }

};
