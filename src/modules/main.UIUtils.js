/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var UIUtils = {

  getWindowEnumerator: function() {
    return Services.wm.getEnumerator("navigator:browser");
  },


  getMostRecentWindow: function() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },


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
    return chromeWin.gBrowser; // <tabbrowser>
  },


  getTabStripContainer: function(chromeWin) {
    return chromeWin.gBrowser.tabContainer; // <tabs>
  },


  getTabList: function(chromeWin) {
    return chromeWin.gBrowser.tabs; // <tab> NodeList
  },


  getSelectedTab: function(chromeWin) {
    return chromeWin.gBrowser.selectedTab; // <tab>
  },


  getLinkedTab: function(browser) {
    var tabList = this.getTabList(browser.ownerDocument.defaultView);
    for (var idx = tabList.length - 1; idx > -1; idx--) {
      if (tabList[idx].linkedBrowser === browser) {
        return tabList[idx]; // <tab>
      }
    }
    return null; // browser.xul has browser elements all over the place
  },


  getChromeWindow: function(contentWin) {
    if ((!contentWin) || (!contentWin.QueryInterface)) {
      console.trace("getChromeWindow contentWin=" + contentWin);
      return null;
    }

    if (contentWin instanceof Ci.nsIDOMChromeWindow) {
      return contentWin; // extensions.xul, updates.xul ...
    }

    var win = contentWin
                .QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsIDocShell)
                .chromeEventHandler.ownerDocument.defaultView;
    console.assert(win !== null, "getChromeWindow null", contentWin);
    console.assert(win !== undefined, "getChromeWindow undefined", contentWin);
    // unwrapped object allows access to gBrowser etc
    return XPCNativeWrapper.unwrap(win);
  }

};



var WindowParents = {
  getTabElement: function(contentWin) {
    var chromeWin = UIUtils.getChromeWindow(contentWin);
    if ((chromeWin !== null) && ("getBrowser" in chromeWin)) {
      var elem = chromeWin.gBrowser; // BUG elem=null for sidebar browsing
      switch (elem.tagName) {
        case "tabbrowser":
          var topDoc = contentWin.top.document;
          var idx = elem.getBrowserIndexForDocument(topDoc);
          if (idx > -1) {
            return elem.tabs[idx];
          }
          break;
        default: // view-source => tagName="browser"
          console.log("getTabElement=" + elem.tagName + "\n" +
                       contentWin.document.documentURI+ " " +chromeWin.location +"\n"+
                       contentWin.location + " " +chromeWin.document.documentURI);
          break;
      }
    }
    return null;
  }
};
