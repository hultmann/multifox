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


function windowLocalStorage(obj, contentDoc) {
  var profileId = Profile.find(contentDoc.defaultView).profileNumber;

  switch (profileId) {
    case Profile.UnknownIdentity:
      return;
    case Profile.DefaultIdentity:
      util2.throwStack.go("windowLocalStorage " + profileId);
      return;
  }


  var originalUri = util2.stringToUri(contentDoc.location.href);
  var uri = toInternalUri(originalUri, profileId);
  var principal = Cc["@mozilla.org/scriptsecuritymanager;1"]
                  .getService(Ci.nsIScriptSecurityManager)
                  .getCodebasePrincipal(uri);

  var storage = Cc["@mozilla.org/dom/storagemanager;1"]
                .getService(Ci.nsIDOMStorageManager)
                .getLocalStorageForPrincipal(principal, "");

  var rv = undefined;
  switch (obj.cmd) {
    case "clear":
      storage.clear();
      break;
    case "removeItem":
      storage.removeItem(obj.key);
      break;
    case "setItem":
      storage.setItem(obj.key, obj.val); // BUG it's ignoring https
      break;
    case "getItem":
      rv = storage.getItem(obj.key);
      break;
    case "key":
      rv = storage.key(obj.index);
      break;
    case "length":
      rv = storage.length;
      break;
    default:
      throw "localStorage interface unknown: " + obj.cmd;
  }

  console.log("localStorage " + uri.spec + "\n"+JSON.stringify(obj, null, 2) + "\n=====\nreturn " + rv);
  return rv;
}
