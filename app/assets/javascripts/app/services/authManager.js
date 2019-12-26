import angular from 'angular';
import { StorageManager } from './storageManager';
import { protocolManager, SFItem, SFPredicate, SFAuthManager } from 'snjs';

export class AuthManager extends SFAuthManager {
  /* @ngInject */
  constructor(
    modelManager,
    singletonManager,
    storageManager,
    alertManager,
    keyManager,
    httpManager,
    $rootScope,
    $timeout,
    $compile
  ) {
    super({
      storageManager,
      httpManager,
      alertManager,
      keyManager,
      timeout: $timeout
    })
    this.$rootScope = $rootScope;
    this.$compile = $compile;
    this.modelManager = modelManager;
    this.singletonManager = singletonManager;
    this.storageManager = storageManager;
  }

  loadInitialData() {
    this.configureUserPrefs();
    this.checkForSecurityUpdate();

    this.modelManager.addItemSyncObserver(
      'user-prefs',
       'SN|UserPreferences',
       (allItems, validItems, deletedItems, source, sourceKey) => {
         this.userPreferencesDidChange();
       }
     );
  }

  async checkForSecurityUpdate() {
    if(this.offline()) {
      return false;
    }

    let latest = protocolManager.version();
    let updateAvailable = await this.protocolVersion() !== latest;
    if(updateAvailable !== this.securityUpdateAvailable) {
      this.securityUpdateAvailable = updateAvailable;
      this.$rootScope.$broadcast("security-update-status-changed");
    }

    return this.securityUpdateAvailable;
  }

  presentPasswordWizard(type) {
    var scope = this.$rootScope.$new(true);
    scope.type = type;
    var el = this.$compile( "<password-wizard type='type'></password-wizard>" )(scope);
    angular.element(document.body).append(el);
  }


  /* User Preferences */

  configureUserPrefs() {
    let prefsContentType = "SN|UserPreferences";

    let contentTypePredicate = new SFPredicate("content_type", "=", prefsContentType);
    this.singletonManager.registerSingleton([contentTypePredicate], (resolvedSingleton) => {
      this.userPreferences = resolvedSingleton;
    }, (valueCallback) => {
      // Safe to create. Create and return object.
      var prefs = new SFItem({content_type: prefsContentType});
      this.modelManager.addItem(prefs);
      this.modelManager.setItemDirty(prefs, true);
      this.$rootScope.sync();
      valueCallback(prefs);
    });
  }

  userPreferencesDidChange() {
    this.$rootScope.$broadcast("user-preferences-changed");
  }

  syncUserPreferences() {
    if(this.userPreferences) {
      this.modelManager.setItemDirty(this.userPreferences, true);
      this.$rootScope.sync();
    }
  }

  getUserPrefValue(key, defaultValue) {
    if(!this.userPreferences) { return defaultValue; }
    var value = this.userPreferences.getAppDataItem(key);
    return (value !== undefined && value != null) ? value : defaultValue;
  }

  setUserPrefValue(key, value, sync) {
    if(!this.userPreferences) { console.log("Prefs are null, not setting value", key); return; }
    this.userPreferences.setAppDataItem(key, value);
    if(sync) {
      this.syncUserPreferences();
    }
  }
}
