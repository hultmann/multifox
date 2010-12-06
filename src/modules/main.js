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

"use strict";

const EXPORTED_SYMBOLS = ["BrowserWindow", // new-window.js
                          "Profile"        // error.js
                         ];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("${PATH_MODULE}/new-window.js");

console.log("===>LOADING main.js");


// tabbrowser attributes:
// "multifox-tabbrowser-last-tab"
// "multifox-tabbrowser-previous-version" - migrating from Multifox 1.x

// tab attributes:
// "multifox-tab-profile"
// "multifox-tab-error" - sandbox error, page not supported
// "multifox-tab-has-login" - login form detected


#include "main.window.js"
#include "main.icon.js"
#include "main.tab-inherit.js"
#include "main.script-injection.js"
#include "main.network.js"
#include "main.cookies.js"
#include "main.storage.js"
#include "main.util.js"


const Profile = {
  UnknownIdentity: "0",
  DefaultIdentity: "1",
  MaxIdentity:     "999999999999999",

  defineIdentity: function(tab, id) {
    var id2 = parseInt(id, 10);
    var min = parseInt(Profile.UnknownIdentity, 10);
    var max = parseInt(Profile.MaxIdentity, 10);

    if (id2 > max) {
      id = Profile.MaxIdentity;
    }
    if (id2 < min) {
      id = Profile.UnknownIdentity;
    }

    tab.setAttribute("multifox-tab-profile", id);
    updateUI(tab);
    return id;
  },

  getIdentity: function(tab) {
    return tab.hasAttribute("multifox-tab-profile")
         ? tab.getAttribute("multifox-tab-profile")
         : Profile.DefaultIdentity;
  },

  find: function(contentWin) {
    if (contentWin === null) {
      return { profileNumber: Profile.UnknownIdentity };
    }

    var url = contentWin.document.location.href;
    if (url.length === 0) {
      return { profileNumber: Profile.UnknownIdentity };
    }

    var tab = WindowParents.getContainerElement(contentWin);
    if (tab === null) {
      // contentWin = source-view, updates.xul
      var profileId = OpenerWindowIdentity.findFromOpenerSelectedTab(contentWin);
      return { profileNumber: profileId };
    }


    var profileId = Profile.getIdentity(tab);
    if (profileId !== Profile.UnknownIdentity) {
      return { profileNumber: profileId, tabElement: tab };
    }

    // fx36 only: "about:blank".contentWin.opener=null => wait real url
    if ((url === "about:blank") && (contentWin.opener === null)) {
      return { profileNumber: Profile.UnknownIdentity, tabElement: tab };
    }

    console.log("Profile.find - finding id - contentWin=" + contentWin.document.location);

    profileId = OpenerWindowIdentity.findFromWindow(contentWin);
    profileId = Profile.defineIdentity(tab, profileId);
    console.log("Profile.find - found! id=" + profileId);
    return { profileNumber: profileId, tabElement: tab };
  },


  activeIdentities: function(ignoreWin) {
    var winEnum = util2.browserWindowsEnum();
    var arr = [];
    while (winEnum.hasMoreElements()) {
      var win = winEnum.getNext();
      if (ignoreWin === win) {
        continue;
      }

      var tabs = getTabs(win.getBrowser());
      for (var idx = tabs.length - 1; idx > -1; idx--) {
        var id = Profile.getIdentity(tabs[idx]);
        if (arr.indexOf(id) === -1) {
          arr.push(id);
        }
      }
    }
    console.log("activeIdentities " + JSON.stringify(arr));
    return arr;
  }

};


const OpenerWindowIdentity = {

  findFromWindow: function(contentWin) {
    // popup via js/window.open?
    if (contentWin.opener) {
      console.log("_getFromOpenerContent opener=" + contentWin.opener.document.location);
      var tabOpener = WindowParents.getContainerElement(contentWin.opener);
      if (tabOpener) {
        return Profile.getIdentity(tabOpener);
      }
    }

    console.log("_getFromOpenerContent - no opener=" + contentWin.opener);

    // fx starting ==> opener=null
    var profileId = this.findFromOpenerSelectedTab(contentWin); // id from selected tab
    if (profileId === Profile.UnknownIdentity) {
      console.log("findFromOpenerSelectedTab id=" + profileId);
      profileId = Profile.DefaultIdentity;
    }

    return profileId;
  },


  findFromOpenerSelectedTab: function(contentWin) {
    var chromeWin = WindowParents.getChromeWindow(contentWin);
    if (chromeWin && chromeWin.opener) {
      var type = chromeWin.opener.document.documentElement.getAttribute("windowtype");
      if (type === "navigator:browser") {
        var selTab = chromeWin.opener.getBrowser().selectedTab;
        return Profile.getIdentity(selTab);
      }
    }
    return Profile.UnknownIdentity;
  }

};


const WindowParents = {
  getContainerElement: function(contentWin) {
    var chromeWin = this.getChromeWindow(contentWin);
    if ((chromeWin !== null) && ("getBrowser" in chromeWin)) {
      var elem = chromeWin.getBrowser();
      switch (elem.tagName) {
        case "tabbrowser":
          var topDoc = contentWin.top.document;
          var idx = elem.getBrowserIndexForDocument(topDoc);
          if (idx > -1) {
            return getTabs(elem)[idx]; // "tab"
          }
          break;
        default: // view-source => tagName="browser"
          console.log("getContainerElement=" + elem.tagName + " " +
                      contentWin.document.location + " " +chromeWin.document.location);
          break;
      }
    }
    return null;
  },

  getChromeWindow: function(contentWin) {
    var qi = contentWin.QueryInterface;
    if (!qi) {
      return null;
    }

    if (contentWin instanceof Ci.nsIDOMChromeWindow) {
      // extensions.xul, updates.xul ...
      return contentWin;
    }

    var win = qi(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsIDocShell)
                .chromeEventHandler
                .ownerDocument
                .defaultView;
    // wrappedJSObject allows access to gBrowser etc
    // wrappedJSObject=undefined sometimes. e.g. contentWin=about:multifox
    var unwrapped = win.wrappedJSObject;
    return unwrapped ? unwrapped : win;
  }

};


function getTabs(tabbrowser) {
  return tabbrowser.mTabContainer.childNodes;
}
