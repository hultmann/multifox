/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function windowLocalStorage(obj, contentDoc) {
  var profileId = FindIdentity.fromContent(contentDoc.defaultView).profileNumber;

  switch (profileId) {
    case Profile.UndefinedIdentity:
      return;
    case Profile.DefaultIdentity:
      console.trace("windowLocalStorage", profileId);
      return;
  }


  var originalUri = stringToUri(contentDoc.location.href);
  var uri = toInternalUri(originalUri, profileId);
  var principal = Cc["@mozilla.org/scriptsecuritymanager;1"]
                  .getService(Ci.nsIScriptSecurityManager)
                  .getNoAppCodebasePrincipal(uri);

  var storage;
  if ("@mozilla.org/dom/localStorage-manager;1" in Cc) {
    storage = Cc["@mozilla.org/dom/localStorage-manager;1"]
                .getService(Ci.nsIDOMStorageManager)
                .createStorage(principal, "");
  } else {
    storage = Cc["@mozilla.org/dom/storagemanager;1"]
                .getService(Ci.nsIDOMStorageManager)
                .getLocalStorageForPrincipal(principal, "");
  }


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

  console.log("localStorage", uri.spec, obj.cmd, obj.key, typeof rv);
  return rv;
}


function stringToUri(spec) {
  try {
    return Services.io.newURI(spec, null, null);
  } catch (ex) {
    return null;
  }
}
