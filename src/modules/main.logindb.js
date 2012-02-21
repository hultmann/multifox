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
 * Portions created by the Initial Developer are Copyright (C) 2011
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


/*
this._tldCookieCounter = {
  "[youtube.com]-[user@gmail.com]-[google.com]": 5
}

this._auths = {
  "google.com": [   // tld
    "efghijklmnop", // user
    "abcdefghijkl"
  ],
  "twtter.com": [
    "efghijklmnop",
  ]

this._loggedInTabs = {
  "my-app.com": [   // tabTld
    "google.com",   // _auths[tld]
    "facebook.com",
    "twitter.com"
  ],
  "orkut.com": [
    "google.com"
  ],
*/


var LoginDB = {
  _auths: null,
  _loggedInTabs: null,
  _tldCookieCounter: null, // invalidateAfterCookieAddition optimization
  _invalidated: true,

  _reset: function() {
    this._auths = { __proto__: null };
    this._loggedInTabs = { __proto__: null };
    this._tldCookieCounter = { __proto__: null };
    this._invalidated = false;
  },

  shutdown: function() {
    this._auths = null;
    this._loggedInTabs = null;
    this._tldCookieCounter = null;
  },

  _invalidate: function() {
    console.trace("_invalidate");
    this._invalidated = true;
  },

  _ensureValid: function() {
    if (this._invalidated) {
      this._update();
      this._invalidated = false;
    }
  },

  setTabAsDefaultLogin: function(tab) {
    var tabLogin = new TabLogin(tab);
    if (tabLogin.hasUser) {
      this.setDefaultLogin(tabLogin.getEncodedTabTld(), tabLogin.encodedUser, tabLogin.encodedTld);
    }
  },

  setDefaultLogin: function setDefaultLogin(encodedTld, encodedLoginUser, encodedLoginTld) {
    console.assert(typeof encodedTld       === "string", "encodedTld=" + encodedTld);
    console.assert(typeof encodedLoginUser === "string", "encodedLoginUser=" + encodedLoginUser);
    console.assert(typeof encodedLoginTld  === "string", "encodedLoginTld=" + encodedLoginTld);

    this._ensureValid();

    if ((encodedTld in this._loggedInTabs) === false) {
      console.log("LoginDB.setDefaultLogin", "encodedTld not found", encodedTld);
      return;
    }

    if ((encodedLoginTld in this._auths) === false) {
      console.log("LoginDB.setDefaultLogin", "encodedLoginTld not found", encodedLoginTld, StringEncoding.decode(encodedLoginTld));
      return;
    }

    var authTlds = this._loggedInTabs[encodedTld]; // usually len=1
    var idx2 = authTlds.indexOf(encodedLoginTld);
    if (idx2 > 0) { // [0] => already the default
      authTlds.splice(idx2, 1);
      authTlds.unshift(encodedLoginTld);
      console.log("LoginDB.setDefaultLogin updated", encodedLoginTld, encodedTld, JSON.stringify(this._loggedInTabs[encodedTld], null, 2));
    }


    var allUsers = this._auths[encodedLoginTld];
    var idx1 = allUsers.indexOf(encodedLoginUser);
    switch (idx1) {
      case 0:
        // nop: user is already the default
        break;
      case -1:
        // user not found (cookies cleared?)
        if (encodedLoginUser === TabLoginHelper.NewAccount) {
          console.log("LoginDB.setDefaultLogin NewAccount", encodedLoginTld, this._auths[encodedLoginTld].toSource(), allUsers.toSource());
          allUsers.unshift(TabLoginHelper.NewAccount);
        }
        break;
      default:
        allUsers.splice(idx1, 1);
        allUsers.unshift(encodedLoginUser); // [0] => default
        console.log("LoginDB.setDefaultLogin updated1", StringEncoding.decode(encodedLoginUser), encodedLoginUser, encodedLoginTld, this._auths[encodedLoginTld].toSource());
        break;
    }
  },


  getDefaultLogin: function getDefaultLogin(tld, fallbackTabInfo) {
    this._ensureValid();

    var encTld = StringEncoding.encode(tld);
    if ((encTld in this._loggedInTabs) === false) {
      console.log("LoginDB.getDefaultLogin - not a logged in website", StringEncoding.decode(encTld), encTld);
      return null;
    }

    // obs: loginUser16/loginTld may be null
    var loginTlds = this._loggedInTabs[encTld];
    var defaultFormTld = loginTlds[0];
    if (defaultFormTld === fallbackTabInfo.encodedTld) {
      return fallbackTabInfo; // reuse/don't change current user
    }

    console.assert(defaultFormTld in this._auths, "this._auths " + defaultFormTld + "/" + tld);
    var users = this._auths[defaultFormTld];
    console.assert(users.length > 0, "users.length");

    var defaultUser = users[0];
    return TabLoginHelper.create(fallbackTabInfo.tabElement, defaultUser, defaultFormTld);
  },


  invalidateAfterCookieAddition: function(internalHostname) {
    var encodedLogin = CookieUtils.getEncodedLogin(internalHostname);
    if (encodedLogin === null) {
      return;
    }
    var encodedData = encodedLogin.rawData;
    if (encodedData in this._tldCookieCounter) {
      this._tldCookieCounter[encodedData]++;
    } else {
      this._tldCookieCounter[encodedData] = 1;
      this._invalidate(); // new login?
    }
  },


  invalidateAfterCookieDeletion: function(internalHostname) {
    var counter = this._tldCookieCounter;
    if (counter === null) {
      return false;
    }
    var encodedLogin = CookieUtils.getEncodedLogin(internalHostname);
    if (encodedLogin === null) {
      return false;
    }
    var encodedData = encodedLogin.rawData;
    console.assert(encodedData in counter, "!encodedData in this._tldCookieCounter " + encodedData);
    counter[encodedData]--;
    if (counter[encodedData] > 0) {
      return false;
    }
    delete counter[encodedData];
    this._invalidate(); // login removed?
    return true; // confirm invalidation
  },


  _update: function() {
    console.trace("LoginDB._update");
    var oldAuths = this._auths; // save current defaults
    var oldLoggedInTabs = this._loggedInTabs;
    this._reset();

    var all = CookieUtils.getAuthCookies();
    setWelcomeMode(all.length === 0);

    var encodedLogin;
    var encodedData; // "[youtube.com]-[user@gmail.com]-[google.com]"
    var tabTld;
    var loginUser;
    var loginTld;

    for (var idx = all.length - 1; idx > -1; idx--) {
      encodedLogin = CookieUtils.getEncodedLogin(all[idx].host);
      if (encodedLogin === null) {
        continue; // default/anon cookie
      }

      encodedData = encodedLogin.rawData;
      if (encodedData in this._tldCookieCounter) {
        this._tldCookieCounter[encodedData]++;
      } else {
        this._tldCookieCounter[encodedData] = 1;
      }

      loginTld  = encodedLogin.loginTld;
      loginUser = encodedLogin.loginUser;
      if (loginTld in this._auths) {
        var authUsers = this._auths[loginTld];
        if (authUsers.indexOf(loginUser) === -1) {
          authUsers.push(loginUser);
        }
      } else {
        this._auths[loginTld] = [loginUser];
      }

      tabTld = encodedLogin.tabTld;
      if (tabTld in this._loggedInTabs) {
        var authTlds = this._loggedInTabs[tabTld];
        if (authTlds.indexOf(loginTld) === -1) {
          authTlds.push(loginTld);
        }
      } else {
        this._loggedInTabs[tabTld] = [loginTld];
      }

    }

    // keep default users
    var tld;
    var user;
    for (var tabTld in oldLoggedInTabs) {
      tld = oldLoggedInTabs[tabTld][0];
      user = oldAuths[tld][0];
      this.setDefaultLogin(tabTld, user, tld);
    }

    console.log("_update\nAuths:",          JSON.stringify(this._auths, null, 2),
                "\n=======\nLoggedInTabs:", JSON.stringify(this._loggedInTabs, null, 2),
                "\n=======\nTLD counter:",  JSON.stringify(this._tldCookieCounter, null, 2)
    );
  },

  // TODO move to TabLogin.isTldLoggedIn(plainTld)?
  isTldLoggedIn: function(plainTld, encodedLoginUser, encodedLoginTld) {
    this._ensureValid();
    var encodedTld = StringEncoding.encode(plainTld);
    if (encodedTld in this._loggedInTabs) {
      var authTlds = this._loggedInTabs[encodedTld];
      var hasAuthTld = authTlds.indexOf(encodedLoginTld) > -1;
      if (hasAuthTld) {
        if (encodedLoginTld in this._auths) {
          if (this._auths[encodedLoginTld].indexOf(encodedLoginUser) > -1) {
            return true;
          }
        }
      }
    }
    return false;
  },

  isLoggedIn: function(plainTld) {
    this._ensureValid();
    return StringEncoding.encode(plainTld) in this._loggedInTabs;
  },

  getEncodedTldUsers: function(encodedTabTld) {
    this._ensureValid();

    if ((encodedTabTld in this._loggedInTabs) === false) {
      return [];
    }
    var authTlds = this._loggedInTabs[encodedTabTld];

    // TODO test multiple sites eg bugzilla + amo
    var tabUsers = [];
    for (var idx1 = authTlds.length - 1; idx1 > -1; idx1--) {
      var loginTld = authTlds[idx1];
      var users = this._auths[loginTld];
      for (var idx2 = users.length - 1; idx2 > -1; idx2--) {
        var encodedUser = users[idx2];
        if (encodedUser === TabLoginHelper.NewAccount) {
          continue;
        }
        tabUsers.push({   plainLoginUser: StringEncoding.decode(encodedUser),
                        encodedLoginUser: encodedUser,
                        encodedLoginTld:  loginTld
        });
      }
    }

    // alphabetical sort
    tabUsers.sort(function(userA, userB) {
      return userB.plainLoginUser.localeCompare(userA.plainLoginUser);
    });

    return tabUsers;
  },

  onCookieRejected: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    observe: function(subject, topic, data) {
      console.log("cookie-rejected 0", subject, topic, data);
      console.log("cookie-rejected 1", subject.QueryInterface(Ci.nsIURI).spec);
    }
  },

  onCookieChanged: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    observe: function(subject, topic, data) {
      if (LoginDB._loggedInTabs === null) {
        return;
      }
      switch (data) {
        case "changed":
          break;
        case "added":
          var cookie = subject.QueryInterface(Ci.nsICookie2);
          LoginDB.invalidateAfterCookieAddition(cookie.host);
          break;
        case "deleted":
          var cookie = subject.QueryInterface(Ci.nsICookie2);
          LoginDB.invalidateAfterCookieDeletion(cookie.host);
          break;
        case "batch-deleted":
          var all = subject.QueryInterface(Ci.nsIArray).enumerate();
          console.trace("cookie BATCH-DELETED!" + data + all);
          while (all.hasMoreElements()) {
            var cookie = all.getNext().QueryInterface(Ci.nsICookie2);
            if (LoginDB.invalidateAfterCookieDeletion(cookie.host)) {
              break; // already invalidated, it is not necessary to continue
            }
          }
          break;
        case "cleared":
          LoginDB._reset();
          break;
        case "reload":
          LoginDB._invalidate();
          break;
        default:
          LoginDB._invalidate(); // ???
          break;
      }
    }
  }
};
