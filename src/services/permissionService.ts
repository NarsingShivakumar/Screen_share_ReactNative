// ============================================
// FILE: src/services/permissionService.ts
// ============================================
/**
 * Permission Service (TypeScript)
 * Handles all app permissions (storage, camera, mic, location, phone, notifications)
 * with proper Android 13+ support and iOS support.
 */

import { Platform, Alert } from 'react-native';
import {
  checkMultiple,
  requestMultiple,
  checkNotifications,
  requestNotifications,
  PERMISSIONS,
  RESULTS,
  openSettings,
  type Permission,
  type PermissionStatus,
  type NotificationOption,
} from 'react-native-permissions';

const isGranted = (status: PermissionStatus): boolean =>
  status === RESULTS.GRANTED || status === RESULTS.LIMITED;

interface PlatformPermissions {
  platformLabel: string;
  corePermissions: Permission[];
}

class PermissionService {
  // ----------------------------------------------------
  // PUBLIC API USED BY App.tsx
  // (Names kept for backwards compatibility)
  // ----------------------------------------------------

  /**
   * App.tsx currently calls this.
   * We now interpret it as: "Are all core app permissions granted?"
   */
  async checkStoragePermission(): Promise<boolean> {
    return this.checkAllPermissions();
  }

  /**
   * App.tsx currently calls this.
   * We now interpret it as: "Request all core app permissions".
   */
  async requestStoragePermission(): Promise<boolean> {
    return this.requestAllPermissions();
  }

  /**
   * Explicit method if you want to call directly:
   * Check all required permissions without prompting.
   */
  async checkAllPermissions(): Promise<boolean> {
    const { corePermissions, platformLabel } =
      this.getPlatformCorePermissions();

    if (corePermissions.length === 0) {
      // Nothing to check on this platform
      return true;
    }

    try {
      const statuses = await checkMultiple(corePermissions);
      // statuses: Record<Permission, PermissionStatus>

      // Notifications are handled separately
      const notifCheck = await checkNotifications();
      const notifStatus = notifCheck.status;

      const allCoreGranted = Object.values(statuses).every(isGranted);
      const notificationsGranted = isGranted(notifStatus);

      console.log(
        `[PermissionService] ${platformLabel} core granted:`,
        allCoreGranted,
        'notifications:',
        notificationsGranted,
      );

      return allCoreGranted && notificationsGranted;
    } catch (error) {
      console.error('[PermissionService] checkAllPermissions error:', error);
      return false;
    }
  }

  /**
   * Explicit method if you want to call directly:
   * Request all required permissions (shows system dialogs).
   */
  async requestAllPermissions(): Promise<boolean> {
    const { corePermissions, platformLabel } =
      this.getPlatformCorePermissions();

    if (corePermissions.length === 0) {
      return true;
    }

    try {
      const currentStatuses = await checkMultiple(corePermissions);
      // Record<Permission, PermissionStatus>

      const entries = Object.entries(
        currentStatuses,
      ) as [Permission, PermissionStatus][];

      const toRequest: Permission[] = entries
        .filter(([, status]) => !isGranted(status))
        .map(([perm]) => perm);

      let finalStatuses: Record<Permission, PermissionStatus> =
        currentStatuses;

      if (toRequest.length > 0) {
        const requested = await requestMultiple(toRequest);
        finalStatuses = { ...currentStatuses, ...requested };
      }

      // Handle notifications separately
      const notifOptions: NotificationOption[] = ['alert', 'sound', 'badge'];
      let notifStatus = (await checkNotifications()).status;
      if (!isGranted(notifStatus)) {
        const notifReq = await requestNotifications(notifOptions);
        notifStatus = notifReq.status;
      }

      const allCoreGranted = Object.values(finalStatuses).every(isGranted);
      const notificationsGranted = isGranted(notifStatus);
      const allGranted = allCoreGranted && notificationsGranted;

      console.log(
        `[PermissionService] ${platformLabel} request result - core: ${allCoreGranted}, notif: ${notificationsGranted}`,
      );

      if (!allGranted) {
        const someBlocked =
          Object.values(finalStatuses).some(
            (s) => s === RESULTS.BLOCKED || s === RESULTS.DENIED,
          ) || notifStatus === RESULTS.BLOCKED;

        if (someBlocked) {
          this.showPermissionBlockedAlert();
        } else {
          this.showGeneralDeniedAlert();
        }
      }

      return allGranted;
    } catch (error) {
      console.error('[PermissionService] requestAllPermissions error:', error);
      this.showGeneralDeniedAlert();
      return false;
    }
  }

  // ----------------------------------------------------
  // INTERNAL HELPERS
  // ----------------------------------------------------

  /**
   * Returns the list of core permissions per platform & API level.
   * This maps to what you declared in AndroidManifest and Info.plist.
   */
  private getPlatformCorePermissions(): PlatformPermissions {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version as number;
      console.log('[PermissionService] Android API Level:', apiLevel);

      // Android 13+ (API 33+) - new scoped media permissions
      if (apiLevel >= 33) {
        return {
          platformLabel: 'Android 13+',
          corePermissions: [
            // Storage / media
            PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
            PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
            PERMISSIONS.ANDROID.READ_MEDIA_AUDIO,
            PERMISSIONS.ANDROID.ACCESS_MEDIA_LOCATION,

            // Camera & mic
            PERMISSIONS.ANDROID.CAMERA,
            PERMISSIONS.ANDROID.RECORD_AUDIO,

            // Location
            PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
            PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,

            // Phone
            PERMISSIONS.ANDROID.READ_PHONE_STATE,
            PERMISSIONS.ANDROID.CALL_PHONE,

            // Notifications (technically handled via checkNotifications,
            // but we keep the constant here for clarity)
            // PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
          ],
        };
      }

      // Android 12 and below - legacy external storage permissions
      return {
        platformLabel: 'Android <= 12',
        corePermissions: [
          // Storage
          PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
          PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
          PERMISSIONS.ANDROID.ACCESS_MEDIA_LOCATION,

          // Camera & mic
          PERMISSIONS.ANDROID.CAMERA,
          PERMISSIONS.ANDROID.RECORD_AUDIO,

          // Location
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,

          // Phone
          PERMISSIONS.ANDROID.READ_PHONE_STATE,
          PERMISSIONS.ANDROID.CALL_PHONE,
        ],
      };
    }

    // iOS
    return {
      platformLabel: 'iOS',
      corePermissions: [
        // Camera
        PERMISSIONS.IOS.CAMERA,

        // Microphone
        PERMISSIONS.IOS.MICROPHONE,

        // Location
        PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,

        // Photos / media
        PERMISSIONS.IOS.PHOTO_LIBRARY,
        PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY,

        // Face ID / biometrics
        PERMISSIONS.IOS.FACE_ID,
      ],
    };
  }

  /**
   * Alert when permission(s) are permanently blocked ("Don't ask again").
   */
  private showPermissionBlockedAlert(): void {
    Alert.alert(
      'Permissions Required',
      'GPMS needs access to storage, camera, microphone, location, phone and notifications to work properly. Please enable these permissions in app settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => {
            openSettings().catch(() =>
              console.warn('Cannot open app settings'),
            );
          },
        },
      ],
    );
  }

  /**
   * Generic alert when permissions are denied but not necessarily blocked.
   */
  private showGeneralDeniedAlert(): void {
    Alert.alert(
      'Permissions Needed',
      'Some permissions were denied. GPMS may not function correctly without them.',
      [
        {
          text: 'OK',
          style: 'default',
        },
      ],
    );
  }
}

export default new PermissionService();
