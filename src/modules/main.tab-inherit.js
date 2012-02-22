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


// tab moved (between windows): TabClose + TabSelect
// workaround: check call stack to detect d&d
var StackAnalyzer = {
  swapBrowsersOnTabSelect: function() {
    for (var s = Components.stack; s; s = s.caller) {
      switch (s.name) {
        case "onxbldrop":                 // swap windows
        case "swapBrowsersAndCloseOther": // swap windows & close previous window (last tab)
          return true;
      }
    }
    return false;
  }
};


// keep multifox id when tab is moved between windows
var MoveTabWindows = {
  _lastClosedTab_domain: null,
  _lastClosedTab_user:   null,
  _remainingTabSelect:   0,

  tabCloseSaveId: function(tab) {
    if (tab.hasAttribute("multifox-tab-id-provider-tld-enc")) {
      var tabLogin = new TabLogin(tab);
      this._lastClosedTab_domain = tabLogin.encodedTld;
      this._lastClosedTab_user   = tabLogin.encodedUser;
      this._remainingTabSelect = 2;
    } else {
      this._remainingTabSelect = 0;
    }
  },

  tabSelectDetectMove: function(tab) {
    if (this._remainingTabSelect === 0) {
      return;
    }
    this._remainingTabSelect--;
    if (StackAnalyzer.swapBrowsersOnTabSelect()) {
      this._remainingTabSelect = 0;
      var tabLogin = TabLoginHelper.create(tab, this._lastClosedTab_user, this._lastClosedTab_domain);
      tabLogin.saveToTab();
    }
  }
};
