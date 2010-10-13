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


function WindowProperties(contentWin) {
  if (contentWin === null) {
    return;
  }
  this._content = contentWin;
  this._browser = this._findBrowser(contentWin);
  if (this._browser) {
    // browser.xul
    this._chrome = this._browser.ownerDocument.defaultView;
  } else {
    this._chrome = this._findChromeWindow(contentWin);
  }
}

WindowProperties.prototype = {
  _content: null,
  _browser: null,
  _chrome: null,
  _profile: -1,

  _findChromeWindow: function(contentWin) {
    if (!contentWin) {
      util2.logEx("_findChromeWindow contentWin", contentWin);
    }

    var docShellTreeItem = contentWin
                            .QueryInterface(Ci.nsIInterfaceRequestor)
                            .getInterface(Ci.nsIWebNavigation)
                            .QueryInterface(Ci.nsIDocShellTreeItem);

    var win = docShellTreeItem
                .rootTreeItem
                .QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIDOMWindow);

    if (win instanceof Ci.nsIDOMChromeWindow) {
      // wrappedJSObject allows access to gBrowser etc
      // it looks like wrappedJSObject=undefined for chrome URLs
      return win.wrappedJSObject ? win.wrappedJSObject : win;
    }

    // it doesn't work sometimes (docShellTreeItem.treeOwner is null)
    util2.logEx("_findChromeWindow", contentWin.document.location, win, this._findBrowser2(contentWin));
    return null;
  },

  _findBrowser: function(contentWin) {
    var chromeWindow = this._findChromeWindow(contentWin);
    if (chromeWindow === null) {
      util.log("_findBrowser - chromeWindow=null. win=" + contentWin.document.location);
      return this._findBrowser2(contentWin);
    }

    var type = chromeWindow.document.documentElement.getAttribute("windowtype");
    if (type !== "navigator:browser") {
      return null;
    }

    var tabbrowser = chromeWindow.getBrowser();
    var idx = tabbrowser.getBrowserIndexForDocument(contentWin.top.document);
    return idx > -1 ? tabbrowser.browsers[idx] : null;
  },


  _findBrowser2: function(contentWin) {
    var topDoc = contentWin.top.document;
    var winEnum = util2.browserWindowsEnum();
    while (winEnum.hasMoreElements()) {
      var tabbrowser = winEnum.getNext().getBrowser();
      var idx = tabbrowser.getBrowserIndexForDocument(topDoc);
      if (idx > -1) {
        return tabbrowser.browsers[idx];
      }
    }
    return null;
  },

  get contentWindow() {
    return this._content;
  },

  get chromeWindow() {
    return this._chrome;
  },

  get browser() {
    return this._browser;
  },

  get identity() {
    if (this._profile === -1) {
      this._profile = this._getIdentity();
    }
    return this._profile;
  },

  _getIdentity: function() {
    if (this.contentWindow === null) {
      return Profile.UnknownIdentity;
    }

    if (this.chromeWindow === null) {
      return Profile.UnknownIdentity;
    }

    if (this.browser === null) {
      // source-view?
      return this._getIdentityFromOpenerChrome();
    }


    var profileId = Profile.getIdentity(this.chromeWindow);
    if (profileId !== Profile.UnknownIdentity) {
      return profileId;
    }

    // popup via js/window.open
    return this._getIdentityFromOpenerContent();
  },

  _getIdentityFromOpenerContent: function() {
    if (this.contentWindow.opener) {
      var browserOpener = this._findBrowser(this.contentWindow.opener);
      if (browserOpener) {
        var chromeOpener = browserOpener.ownerDocument.defaultView;
        var profileId = Profile.getIdentity(chromeOpener);
        if (profileId > Profile.UnknownIdentity) {
          return Profile.defineIdentity(this.chromeWindow, profileId);
        }
      }
    }

    util.log("request [" + profileId + "] id.opener="+ profileId);
    return Profile.UnknownIdentity;
  },

  _getIdentityFromOpenerChrome: function() {
    var tabbrowser = null;
    var type = this.chromeWindow.document.documentElement.getAttribute("windowtype");
    if (type === "navigator:view-source") {
      var winOpener = this.chromeWindow.opener;
      if (winOpener) {
        if (winOpener.document.documentElement.getAttribute("windowtype") === "navigator:browser") {
          tabbrowser = winOpener.getBrowser();
        }
      }
    }

    return tabbrowser !== null ? Profile.getIdentity(tabbrowser.ownerDocument.defaultView)
                               : Profile.UnknownIdentity; // favicon, ...
  }

};
