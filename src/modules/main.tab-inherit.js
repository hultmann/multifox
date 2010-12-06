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


// new tab:                     TabOpen
// tab moved (between windows): TabClose + TabSelect


// workaround: check call stack to detect clicks or d&d
const StackAnalyzer = {
  swapBrowsersOnTabSelect: function() {
    for (var s = Components.stack; s; s = s.caller) {
      switch (s.name) {
        case "swapBrowsersAndCloseOther":
        case "onxbldrop": //fx4
        case "_onDrop":   //fx36
          return true;
      }
    }
    return false;
  },

  inheritIdOnTabOpen: function() {
    for (var s = Components.stack; s; s = s.caller) {
      switch (s.name) {
        case "openNewTabWith":
        case "handleLinkClick":
        case "BrowserReloadOrDuplicate":
          return true;
      }
    }
    return false;
  }
};


function findTabByLinkedPanel(tabId, tabbrowser) {
  var tabs = getTabs(tabbrowser);
  for (var idx = tabs.length - 1; idx > -1; idx--) {
    if (tabs[idx].linkedPanel === tabId) {
      return tabs[idx];
    }
  }
  return null;
}


// check if new tab should inherit identity from current tab
const NewTabId = {
  tabSelectSetAsLastTab: function(tab) {
    var tabId = tab.getAttribute("linkedpanel");
    var tabbrowser = tab.ownerDocument.defaultView.getBrowser();
    tabbrowser.setAttribute("multifox-tabbrowser-last-tab", tabId);
  },

  tabOpenInheritId: function(tab) {
    if (StackAnalyzer.inheritIdOnTabOpen() === false) {
      return false;
    }

    // find inherited id
    var doc = tab.ownerDocument;
    var tabbrowser = doc.defaultView.getBrowser();
    var attr = "multifox-tabbrowser-last-tab";
    if (tabbrowser.hasAttribute(attr) === false) {
      return false;
    }

    var tabId = tabbrowser.getAttribute(attr);
    var inheritedTab = findTabByLinkedPanel(tabId, tabbrowser);
    if (inheritedTab === null) {
      return false;
    }

    Profile.defineIdentity(tab, Profile.getIdentity(inheritedTab));
    return true;
  }
};


// keep multifox id when tab is moved between windows
const MoveTabWindows = {
  _lastClosedTab: null,
  _remainingTabSelect: 0,

  tabCloseSaveId: function(tab) {
    if (tab.hasAttribute("multifox-tab-profile")) {
      this._lastClosedTab = Profile.getIdentity(tab);
      this._remainingTabSelect = 2;
    } else {
      this._remainingTabSelect = 0;
    }
  },

  tabSelectDetectMove: function(tab) {
    if (this._remainingTabSelect > 0) {
      this._remainingTabSelect--;
      if (StackAnalyzer.swapBrowsersOnTabSelect()) {
        Profile.defineIdentity(tab, this._lastClosedTab);
        this._remainingTabSelect = 0;
      }
    }
  }
};
