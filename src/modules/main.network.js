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


var NetworkObserver = {

  start: function() {
    console.log("NetworkObserver start");
    var obs = Services.obs;
    obs.addObserver(this._request, "http-on-modify-request", false);
    obs.addObserver(this._response, "http-on-examine-response", false);
  },


  stop: function() {
    console.log("NetworkObserver stop");
    var obs = Services.obs;
    obs.removeObserver(this._request, "http-on-modify-request");
    obs.removeObserver(this._response, "http-on-examine-response");
  },


  _request: {
    // nsIObserver
    observe: function HttpListeners_request(subject, topic, data) {
      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      var win = getChannelWindow(httpChannel);

      if (win === null) {
        // safebrowsing, http://wpad/wpad.dat
        return;
      }

      var docUser;
      var isWin = isWindowChannel(httpChannel);

      var tab = WindowParents.getTabElement(win);
      if (tab !== null) {
        if (isWin) {
          // window/redir/download
          var msgData = fillDocReqData(win);
          docUser = NewDocUser.addDocumentRequest(msgData, httpChannel);
        } else {
          // css/js/xhr...
          var winutils = getDOMUtils(win);
          docUser = WinMap.getUserForAsset(winutils.currentInnerWindowID, win.location.href, httpChannel.URI);
        }

      } else {
        var chromeWin = UIUtils.getChromeWindow(win);
        if (chromeWin && UIUtils.isSourceWindow(chromeWin)) {
          // view source window
          console.log("REQUEST - viewsource", httpChannel.URI.spec);
          docUser = NewDocUser.viewSourceRequest(win, httpChannel.URI);
        } else {
          console.log("REQUEST - TAB NOT FOUND", httpChannel.URI.spec);
          return; // tab not found: request from chrome (favicon, updates, <link rel="next"...)
        }
      }


      if (UserUtils.isAnon(docUser)) {
        if ((docUser === null) && LoginDB.isLoggedIn(StringEncoding.encode(getTldFromHost(httpChannel.URI.host)))) {
          console.log("REQ ERR - login found but not used!", isWin, httpChannel.URI.spec, win.location.href);
        }
        return; // send default cookies
      }

      var myHeaders = HttpHeaders.fromRequest(httpChannel);
      if (myHeaders["authorization"] !== null) {
        enableErrorMsgLocal("authorization", win);
        return;
      }

      var cookie = Cookies.getCookie(false, httpChannel.URI, docUser.appendLoginToUri(httpChannel.URI));
      httpChannel.setRequestHeader("Cookie", cookie, false);
    }
  },

  _response: {
    // nsIObserver
    observe: function HttpListeners_response(subject, topic, data) {
      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      var win = getChannelWindow(httpChannel);
      if (win === null) {
        return;
      }

      var tab = WindowParents.getTabElement(win);
      if (tab === null) {
        return;
      }

      var isWin = isWindowChannel(httpChannel);
      var winutils = getDOMUtils(win);

      var docUser;
      if (isWin) {
        // window/redir/download
        docUser = NewDocUser.addDocumentResponse(httpChannel,
                                                 winutils.currentInnerWindowID,
                                                 winutils.outerWindowID);
      } else {
        docUser = WinMap.getUserForAsset(winutils.currentInnerWindowID,
                                         win.location.href,
                                         httpChannel.URI);
      }


      if (UserUtils.isAnon(docUser)) {
        if ((docUser === null) && LoginDB.isLoggedIn(StringEncoding.encode(getTldFromHost(httpChannel.URI.host)))) {
          console.log("RESPONSE ERR - login found but not used!", isWin, httpChannel.URI.spec, win.location.href);
        }
        return;
      }

      var myHeaders = HttpHeaders.fromResponse(httpChannel);

      var setCookies = myHeaders["set-cookie"];
      if (setCookies === null) {
        return;
      }

      if (myHeaders["www-authenticate"] !== null) {
        if (win === null) {
          return;
        }
        enableErrorMsgLocal("www-authenticate", win);
        return;
      }

      // remove "Set-Cookie"
      httpChannel.setResponseHeader("Set-Cookie", null, false);

      Cookies.setCookie(docUser, httpChannel.URI, setCookies, false);
    }
  }
};




var HttpHeaders = {
  visitLoop: {
    values: null,
    visitHeader: function(name, value) {
      var n = name.toLowerCase();
      if (n in this.values) {
        this.values[n] = value;
      }
    }
  },

  fromRequest: function(request) {
    var nameValues = {
      //"cookie": null, //for debug only
      "authorization": null
    }
    this.visitLoop.values = nameValues;
    request.visitRequestHeaders(this.visitLoop);
    return nameValues;
  },

  fromResponse: function(response) {
    var nameValues = {
      "set-cookie": null,
      "www-authenticate": null
    }
    this.visitLoop.values = nameValues;
    response.visitResponseHeaders(this.visitLoop);
    return nameValues;
  }
};


function fillDocReqData(win) {
  var utils = getDOMUtils(win);

  if (isTopWindow(win) === false) {
    console.assert(win.opener === null, "is an iframe supposed to have an opener?");
    var utilsParent = getDOMUtils(win.parent);
    return {
      __proto__ :  null,
      outer:       utils.outerWindowID,
      inner:       utils.currentInnerWindowID,
      parentOuter: utilsParent.outerWindowID,
      parentInner: utilsParent.currentInnerWindowID,
      parentUrl:   win.parent.location.href
    };
  }

  if (win.opener) {
    var msgData = {
      __proto__ :  null,
      outer:       utils.outerWindowID,
      inner:       utils.currentInnerWindowID,
      parentOuter: WinMap.TopWindowFlag,
      parentInner: WinMap.TopWindowFlag
    };
    var utilsOpener = getDOMUtils(win.opener);
    msgData.openerOuter = utilsOpener.outerWindowID;
    msgData.openerInner = utilsOpener.currentInnerWindowID;
    msgData.openerUrl   = win.opener.location.href;
    return msgData;
  }

  return {
    __proto__ :  null,
    outer:       utils.outerWindowID,
    inner:       utils.currentInnerWindowID,
    parentOuter: WinMap.TopWindowFlag,
    parentInner: WinMap.TopWindowFlag
  };
}


function isWindowChannel(channel) {
  return (channel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI) !== 0;
}


function getChannelWindow(channel) {
  if (channel.notificationCallbacks) {
    try {
      return channel
              .notificationCallbacks
              .getInterface(Ci.nsILoadContext)
              .associatedWindow;
    } catch (ex) {
      //console.trace("channel.notificationCallbacks " + "/" + channel.notificationCallbacks + "/" + channel.URI.spec + "/" + ex);
    }
  }

  if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
    try {
      return channel
              .loadGroup
              .notificationCallbacks
              .getInterface(Ci.nsILoadContext)
              .associatedWindow;
    } catch (ex) {
      console.trace("channel.loadGroup " + channel.loadGroup + "/" + channel.URI.spec + "/" + ex);
    }
  }

  //var isChrome = context.associatedWindow instanceof Ci.nsIDOMChromeWindow;
  //return context.isContent ? context.associatedWindow : null;
  //console.log("LOAD CONTEXT FAIL " + channel.URI.spec);
  return null; // e.g. <link rel=prefetch> <link rel=next> ...
}
