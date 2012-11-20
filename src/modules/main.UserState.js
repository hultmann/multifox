/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var UserState = {

  hasUsers: function(topInnerId) {
    var topData = WinMap.getInnerEntry(topInnerId);
    if ("docUserObj" in topData) {
      return true;
    }

    if (("thirdPartyUsers" in topData) === false) {
      return false;
    }

    var thirdParty = topData.thirdPartyUsers;
    for (var tld in thirdParty) {
      if (thirdParty[tld] !== null) {
        return true;
      }
    }

    return false;
  },


  // Save, for the top document, its iframes, and resources.
  //
  // thirdPartyUsers["facebook.com"]=null
  //   Keep 3rd-party anonymous TLDs for tab consistency.
  //   There is no login for facebook (yet).
  //   A login may eventually happen in another tab.
  //
  // thirdPartyUsers["facebook.com"]=UserId
  //   User will be displayed in the Multifox menu.
  //   It is just a log, it is not used by findUser
  //
  addRequest: function(uri, channelWindow, isWinChannel, docUser) {
    if (isWinChannel && isTopWindow(channelWindow)) {
      return;
    }

    var topInnerId = getDOMUtils(channelWindow.top).currentInnerWindowID;
    var topData = WinMap.getInnerEntry(topInnerId);
    var tldTop = getTldFromUri(Services.io.newURI(topData.url, null, null));
    var tldRequest = getTldFromUri(uri);
    if ((tldRequest === null) || (tldRequest === tldTop)) { // tldTop=null => about:multifox
      return;
    }


    // user=null => null or anon window/asset request using an inherited user
    var usr = (docUser !== null) && docUser.equalsToLoggedInTld(tldRequest)
            ? docUser.user
            : null;

    if ("thirdPartyUsers" in topData) {
      if (tldRequest in topData.thirdPartyUsers) {
        var current = topData.thirdPartyUsers[tldRequest];
        if (UserUtils.equalsUser(current, usr) === false) {
          // TODO previous user removed. usr is probably NewAccount. how to handle it?
          console.warn("replacing user?", current, usr);
        }
      } else {
        topData.thirdPartyUsers[tldRequest] = usr;
      }
    } else {
      topData.thirdPartyUsers = Object.create(null);
      topData.thirdPartyUsers[tldRequest] = usr;
    }
  },


  isThirdPartyTldAnon: function(tld, topInnerId) {
    console.assert(WinMap.isTabId(WinMap.getInnerEntry(topInnerId).parentInnerId), "not a top doc", tld, topInnerId, WinMap.getInnerEntry(topInnerId));
    var topData = WinMap.getInnerEntry(topInnerId);
    return ("thirdPartyUsers" in topData) &&
           (tld in topData.thirdPartyUsers) &&
           (topData.thirdPartyUsers[tld] === null);
  },


  // the first user for tldDoc?
  // update topData (as NewAccount) and make it the default for tab
  addUserToMappedDocuments: function(newDocUser, loginOuterId) {
    if (newDocUser === null) {
      return;
    }

    var loginTopOuterId = WinMap.getTabId(loginOuterId);
    var newAccount = newDocUser.user.toNewAccount();
    var tldDoc = newDocUser.ownerTld;
    var updated = false;

    for (var id in WinMap._inner) {
      var intId = parseInt(id, 10);
      var docData = WinMap._inner[intId];
      var topOuterId = WinMap.getTabId(docData.outerId);

      var isAnon = (("pending_login" in docData) === false)
                && (("docUserObj"    in docData) === false);
      var sameTab = topOuterId === loginTopOuterId;
      if (isAnon) {
        // update affected documents
        var uri = Services.io.newURI(docData.url, null, null);
        if (getTldFromUri(uri) === tldDoc) {
          updated = true;
          var userId = sameTab ? newDocUser.user : newAccount;
          WinMap.setUserForTab(topOuterId, tldDoc, userId);

          var topInnerId = WinMap.getTopInnerId(intId);
          docData.docUserObj = new DocumentUser(userId, tldDoc, topInnerId);
        }
      }


      // update thirdPartyUsers
      if (docData.parentInnerId !== WinMap.TopWindowFlag) {
        continue; // only top docs have a 3rd-party field
      }
      if (("thirdPartyUsers" in docData) === false) {
        continue; // nothing to do
      }
      var thirdParty = docData.thirdPartyUsers;
      if ((tldDoc in thirdParty) && (thirdParty[tldDoc] === null)) {
        updated = true;
        WinMap.setUserForTab(topOuterId, tldDoc, newAccount);
        thirdParty[tldDoc] = newAccount; // show it now as "New Account"
      }
    }

    WinMap.setUserForTab(loginTopOuterId, tldDoc, newDocUser.user);

    if (updated) {
      this._updateAllWindows();
    }
  },


  removeUserFromCurrentDocuments: function(tldDoc, delUserId) {
    var docData;
    var userId;
    var updated = false;
    var isTldEmpty = LoginDB.getUsers(StringEncoding.encode(tldDoc)).length === 0;

    for (var id in WinMap._inner) {
      var intId = parseInt(id, 10);
      docData = WinMap._inner[intId];
      if (("docUserObj" in docData) === false) {
        continue;
      }

      var uri = Services.io.newURI(docData.url, null, null);
      if (getTldFromUri(uri) !== tldDoc) {
        continue;
      }

      if (isTldEmpty) {
        updated = true;
        delete docData.docUserObj;
        this._removeTldFromTab(docData.outerId, tldDoc);

      } else {
        if (delUserId.equals(docData.docUserObj.user)) {
          updated = true;
          userId = delUserId.toNewAccount();
          // replace current users by NewAccount
          var topInnerId = WinMap.getTopInnerId(intId);
          docData.docUserObj = new DocumentUser(userId, tldDoc, topInnerId);
          WinMap.setUserForTab(docData.outerId, tldDoc, userId);
        }
      }

      // no need to update thirdPartyUsers
    }

    if (updated) {
      this._updateAllWindows();
    }
  },


  _updateAllWindows: function() {
    var tab;
    var enumWin = UIUtils.getWindowEnumerator();
    while (enumWin.hasMoreElements()) {
      tab = UIUtils.getSelectedTab(enumWin.getNext());
      updateUIAsync(tab, true);
    }
  },


  _removeTldFromTab: function(topOuterId, tldDoc) {
    var tabData = WinMap.getOuterEntry(topOuterId);
    if ("tabLogins" in tabData) {
      if (tldDoc in tabData.tabLogins.firstParty) {
        delete tabData.tabLogins.firstParty[tldDoc];
      }
    }
  }

};
