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

const httpListeners = {
  request: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

    // nsIObserver
    observe: function(aSubject, aTopic, aData) {
      var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
      var winChannel = getChannelWindow(httpChannel);
      var profileId = Profile.findIdentity(winChannel);
      switch (profileId) {
        case Profile.DefaultIdentity:
        case Profile.UnknownIdentity: // favicon, updates
          return;
      }

      var myHeaders = HttpHeaders.fromRequest(httpChannel);
      if (myHeaders["authorization"] !== null) {
        Components.utils.import("${URI_JS_MODULE}/error.js");
        showError(winChannel, "authorization");
        return;
      }

      var cook = Cookies.getCookie(false, httpChannel.URI, profileId);
      httpChannel.setRequestHeader("Cookie", cook, false);
    }
  },

  response: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

    // nsIObserver
    observe: function(aSubject, aTopic, aData) {
      var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
      var winChannel = getChannelWindow(httpChannel);
      var profileId = Profile.findIdentity(winChannel);
      switch (profileId) {
        case Profile.DefaultIdentity:
        case Profile.UnknownIdentity:
          /*
          var myHeaders = HttpHeaders.fromResponse(httpChannel);
          var setCookies = myHeaders["set-cookie"];
          if (setCookies !== null) {
            util.log("req "+profileId+"--"+httpChannel.URI.spec+"\n"+setCookies);
          }
          */
          return;
      }


      var myHeaders = HttpHeaders.fromResponse(httpChannel);
      if (myHeaders["www-authenticate"] !== null) {
        Components.utils.import("${URI_JS_MODULE}/error.js");
        showError(winChannel, "www-authenticate");
        return;
      }

      var setCookies = myHeaders["set-cookie"];
      if (setCookies === null) {
        return;
      }

      // server sent "Set-Cookie"
      httpChannel.setResponseHeader("Set-Cookie", null, false);
      Cookies.setCookie(profileId, httpChannel.URI, setCookies, false);
    }
  }
};


const HttpHeaders = {
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


function getChannelWindow(channel) {
  if (channel.notificationCallbacks) {
    try {
      return channel
              .notificationCallbacks
              .getInterface(Ci.nsILoadContext)
              .associatedWindow;
    } catch (ex) {
      //util2.logEx("channel.notificationCallbacks ", channel.notificationCallbacks, channel.URI.spec, ex);
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
      util2.logEx("channel.loadGroup", channel.loadGroup, channel.URI.spec, ex);
    }
  }

  //var isChrome = context.associatedWindow instanceof Ci.nsIDOMChromeWindow;
  //return context.isContent ? context.associatedWindow : null;
  //util.log("LOAD CONTEXT FAIL " + channel.URI.spec);
  return null; // e.g. <link rel=prefetch> <link rel=next> ...
}
