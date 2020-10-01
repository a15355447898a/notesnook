import {useIsFocused} from '@react-navigation/native';
import React, {useEffect} from 'react';
import {
  Appearance,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFetchBlob from 'rn-fetch-blob';
import {
  ACCENT,
  COLOR_SCHEME,
  COLOR_SCHEME_DARK,
  COLOR_SCHEME_LIGHT,
  opacity,
  pv,
  setColorScheme,
  SIZE,
  WEIGHT,
} from '../../common/common';
import {Button} from '../../components/Button';
import {PressableButton} from '../../components/PressableButton';
import Seperator from '../../components/Seperator';
import {useTracked} from '../../provider';
import {ACTIONS} from '../../provider/actions';
import {eSendEvent} from '../../services/eventManager';
import {
  eCloseProgressDialog,
  eOpenLoginDialog,
  eOpenPremiumDialog,
  eOpenProgressDialog,
  eOpenRecoveryKeyDialog,
  eOpenRestoreDialog,
  eResetApp,
} from '../../services/events';
import NavigationService from '../../services/NavigationService';
import storage, {MMKV} from '../../utils/storage';
import {
  db,
  DDS,
  hexToRGBA,
  requestStoragePermission,
  RGB_Linear_Shade,
  setSetting,
  sleep,
  ToastEvent,
  w,
} from '../../utils/utils';

export const Settings = ({route, navigation}) => {
  const [state, dispatch] = useTracked();
  const {colors, user, settings} = state;
  const isFocused = useIsFocused();
  function changeColorScheme(colors = COLOR_SCHEME, accent = ACCENT) {
    let newColors = setColorScheme(colors, accent);
    StatusBar.setBarStyle(colors.night ? 'light-content' : 'dark-content');
    dispatch({type: ACTIONS.THEME, colors: newColors});
  }

  function changeAccentColor(accentColor) {
    ACCENT.color = accentColor;
    ACCENT.shade = accentColor + '12';
    changeColorScheme();
  }

  useEffect(() => {
    console.log(user);
    if (isFocused) {
      dispatch({
        type: ACTIONS.CONTAINER_BOTTOM_BUTTON,
        state: {
          visible: false,
        },
      });
      dispatch({
        type: ACTIONS.HEADER_STATE,
        state: {
          type: null,
          menu: true,
          canGoBack: false,
          color: null,
        },
      });
      dispatch({
        type: ACTIONS.HEADER_VERTICAL_MENU,
        state: false,
      });

      dispatch({
        type: ACTIONS.HEADER_TEXT_STATE,
        state: {
          heading: 'Settings',
        },
      });

      dispatch({
        type: ACTIONS.CURRENT_SCREEN,
        screen: 'settings',
      });

      dispatch({
        type: ACTIONS.SEARCH_STATE,
        state: {
          noSearch: true,
        },
      });
    }
  }, [isFocused]);

  const getTimeLeft = (t1, t2) => {
    let d1 = new Date(Date.now());
    let d2 = new Date(t2);
    let diff = d2.getTime() - d1.getTime();
    diff = (diff / (1000 * 3600 * 24)).toFixed(0);

    return diff;
  };

  const SectionHeader = ({title}) => (
    <Text
      style={{
        fontSize: SIZE.xs,
        fontFamily: WEIGHT.bold,
        textAlignVertical: 'center',
        color: colors.accent,
        paddingHorizontal: 12,
        borderBottomColor: colors.nav,
        borderBottomWidth: 0.5,
        paddingBottom: 3,
      }}>
      {title}
    </Text>
  );

  const backupItemsList = [
    {
      name: 'Backup data',
      func: async () => {
        let granted = requestStoragePermission();
        if (!granted) {
          ToastEvent.show('Backup failed! Storage access was denied.');
          return;
        }

        eSendEvent(eOpenProgressDialog, {
          title: 'Backing up your data',
          paragraph:
            "All your backups are stored in 'Phone Storage/Notesnook/backups' folder",
        });
        let backup = await db.backup.export();
        let backupName =
          'notesnook_backup_' + new Date().toString() + '.nnbackup';
        let path = RNFetchBlob.fs.dirs.SDCardDir + '/Notesnook/backups/';
        await storage.checkAndCreateDir(path);
        await RNFetchBlob.fs.writeFile(path + backupName, backup, 'utf8');

        await sleep(2000);
        eSendEvent(eCloseProgressDialog);
        ToastEvent.show('Backup complete!', 'success');
        //Linking.openURL('https://www.notesnook.com/privacy.html');
      },
      desc: 'Backup all your data to phone storage',
    },
    {
      name: 'Restore backup',
      func: () => {
        eSendEvent(eOpenRestoreDialog);
      },
      desc: 'Restore backup from your phone.',
    },
  ];

  const switchTheme = async () => {
    await setSetting(settings, 'useSystemTheme', !settings.useSystemTheme);

    if (!settings.useSystemTheme) {
      MMKV.setStringAsync(
        'theme',
        JSON.stringify({night: Appearance.getColorScheme() === 'dark'}),
      );
      changeColorScheme(
        Appearance.getColorScheme() === 'dark'
          ? COLOR_SCHEME_DARK
          : COLOR_SCHEME_LIGHT,
      );
    }
  };

  const CustomButton = ({title, tagline, customComponent, onPress}) => (
    <PressableButton
      color="transparent"
      selectedColor={colors.nav}
      alpha={!colors.night ? -0.02 : 0.02}
      onPress={onPress}
      customStyle={{
        minHeight: 50,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        width: '100%',
        borderRadius: 0,
        flexDirection: 'row',
      }}>
      <Text
        style={{
          fontSize: SIZE.sm,
          fontFamily: WEIGHT.regular,
          textAlignVertical: 'center',
          color: colors.pri,
        }}>
        {title}
        {tagline ? '\n' : null}

        <Text
          style={{
            fontSize: SIZE.xs,
            color: colors.icon,
          }}>
          {tagline}
        </Text>
      </Text>
      {customComponent ? customComponent : null}
    </PressableButton>
  );

  return (
    <Animatable.View
      transition="backgroundColor"
      duration={300}
      style={{
        height: '100%',
        backgroundColor: colors.bg,
      }}>
      <View
        style={{
          marginTop: Platform.OS == 'ios' ? 125 - 60 : 125 - 60,
        }}
      />
      <ScrollView
        style={{
          paddingHorizontal: 0,
        }}>
        {user && user.Id ? (
          <>
            <View
              style={{
                paddingHorizontal: 12,
              }}>
              <View
                style={{
                  alignSelf: 'center',
                  width: '100%',
                  marginBottom: pv,
                  marginTop: pv,
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: colors.shade,
                }}>
                <View
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexDirection: 'row',
                  }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <Icon
                      size={SIZE.md}
                      color={colors.accent}
                      name="account-outline"
                    />
                    <Text
                      style={{
                        color: colors.heading,
                        marginLeft: 5,
                        fontFamily: WEIGHT.regular,
                        fontSize: SIZE.sm,
                      }}>
                      {user.username}
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 5,
                      padding: 5,
                      paddingVertical: 2.5,
                      backgroundColor: 'white',
                    }}>
                    <Text
                      style={{
                        color: colors.accent,
                        fontFamily: WEIGHT.regular,
                        fontSize: SIZE.xs,
                      }}>
                      {user.notesnook.subscription.isTrial ? 'Trial' : 'Pro'}
                    </Text>
                  </View>
                </View>
                <Seperator />
                <View>
                  {user.notesnook.subscription.isTrial ? (
                    <Text
                      style={{
                        color:
                          getTimeLeft(
                            user.notesnook.subscription.start,
                            user.notesnook.subscription.expiry,
                          ) > 5
                            ? colors.pri
                            : colors.errorText,
                        fontFamily: WEIGHT.regular,
                        fontSize: SIZE.xxl,
                      }}>
                      {getTimeLeft(
                        user.notesnook.subscription.start,
                        user.notesnook.subscription.expiry,
                      ) + ' Days Remaining'}
                    </Text>
                  ) : null}

                  <Seperator />

                  <Button
                    onPress={() => {
                      eSendEvent(eOpenPremiumDialog);
                    }}
                    width="100%"
                    title="Get Notesnook Pro"
                    height={40}
                  />
                </View>
                {
                  // Ad code here
                }
              </View>
            </View>
            {[
              {
                name: 'Save Data Recovery Key',
                func: async () => {
                  eSendEvent(eOpenRecoveryKeyDialog);
                },
                desc:
                  'We recommend you to get your data recovery key and store it safely. If you lose your password, you can recover your data using your recovery key.',
              },
              {
                name: 'Logout',
                func: async () => {
                  await db.user.logout();
                  dispatch({type: ACTIONS.USER, user: null});
                  dispatch({type: ACTIONS.CLEAR_ALL});
                },
                desc:
                  'Logout of your account, this will clear everything and reset the app.',
              },
            ].map((item) => (
              <CustomButton
                key={item.name}
                title={item.name}
                onPress={item.func}
                tagline={item.desc}
              />
            ))}
          </>
        ) : (
          <>
            <View
              style={{
                paddingHorizontal: 12,
              }}>
              <PressableButton
                color={colors.shade}
                selectedColor={colors.accent}
                alpha={!colors.night ? -0.02 : 0.1}
                opacity={0.12}
                onPress={() => {
                  eSendEvent(eOpenLoginDialog);
                }}
                activeOpacity={opacity / 2}
                customStyle={{
                  paddingVertical: pv + 5,
                  marginBottom: pv + 5,
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  borderRadius: 5,
                  paddingHorizontal: 6,
                }}>
                <View
                  style={{
                    width: 40,
                    backgroundColor: colors.accent,
                    height: 40,
                    marginLeft: 10,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon size={SIZE.lg} color="white" name="account-outline" />
                </View>

                <View
                  style={{
                    marginLeft: 10,
                  }}>
                  <Text
                    style={{
                      fontFamily: WEIGHT.regular,
                      color: colors.icon,
                      fontSize: SIZE.xs,
                    }}>
                    You are not logged in
                  </Text>
                  <Text
                    style={{
                      color: colors.accent,
                    }}>
                    Login to sync notes.
                  </Text>
                </View>

                <View
                  style={{
                    width: 40,
                    height: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'absolute',
                    right: 6,
                  }}>
                  <Icon
                    name="chevron-right"
                    color={colors.accent}
                    size={SIZE.lg}
                  />
                </View>
              </PressableButton>
            </View>
          </>
        )}
        <SectionHeader title="Appearance" />

        <Text
          style={{
            fontSize: SIZE.sm,
            fontFamily: WEIGHT.regular,
            textAlignVertical: 'center',
            color: colors.pri,
            marginTop: pv + 5,
            paddingHorizontal: 12,
          }}>
          Accent Color{'\n'}
          <Text
            style={{
              fontSize: SIZE.xs,
              color: colors.icon,
            }}>
            Choose a color to use as accent color
          </Text>
        </Text>

        <View
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
          style={{
            borderRadius: 5,
            padding: 5,
            marginTop: 10,
            marginBottom: pv + 5,
            width: '100%',
            alignSelf: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 12,
          }}>
          {[
            '#e6194b',
            '#3cb44b',
            '#ffe119',
            '#0560FF',
            '#f58231',
            '#911eb4',
            '#46f0f0',
            '#f032e6',
            '#bcf60c',
            '#fabebe',
          ].map((item) => (
            <PressableButton
              key={item}
              color={
                colors.accent === item
                  ? RGB_Linear_Shade(
                      !colors.night ? -0.2 : 0.2,
                      hexToRGBA(item, 1),
                    )
                  : item
              }
              selectedColor={item}
              alpha={!colors.night ? -0.1 : 0.1}
              opacity={1}
              onPress={() => {
                changeAccentColor(item);

                MMKV.setStringAsync('accentColor', item);
              }}
              customStyle={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                marginHorizontal: 5,
                marginVertical: 5,
                width: DDS.isTab ? (w * 0.28) / 5 - 35 : w / 5 - 35,
                height: DDS.isTab ? (w * 0.28) / 5 - 35 : w / 5 - 35,
                borderRadius: 100,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              {colors.accent === item ? (
                <Icon size={SIZE.lg} color="white" name="check" />
              ) : null}
            </PressableButton>
          ))}
        </View>

        <CustomButton
          title="Use System Dark Mode"
          tagline={
            settings.useSystemTheme
              ? 'Switch to dark theme based on system settings'
              : 'Keep the app theme independent from system settings'
          }
          onPress={switchTheme}
          customComponent={
            <Icon
              size={SIZE.xl}
              color={settings.useSystemTheme ? colors.accent : colors.icon}
              name={
                settings.useSystemTheme ? 'toggle-switch' : 'toggle-switch-off'
              }
            />
          }
        />

        <CustomButton
          title="Dark Mode"
          tagline={colors.night ? 'Turn off dark mode' : 'Turn on dark mode'}
          onPress={() => {
            if (!colors.night) {
              MMKV.setStringAsync('theme', JSON.stringify({night: true}));
              changeColorScheme(COLOR_SCHEME_DARK);
            } else {
              MMKV.setStringAsync('theme', JSON.stringify({night: false}));

              changeColorScheme(COLOR_SCHEME_LIGHT);
            }
          }}
          customComponent={
            <Icon
              size={SIZE.xl}
              color={colors.night ? colors.accent : colors.icon}
              name={colors.night ? 'toggle-switch' : 'toggle-switch-off'}
            />
          }
        />

        <View
          style={{
            width: '100%',
            marginHorizontal: 0,
            height: 50,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
          }}>
          <Text
            style={{
              fontSize: SIZE.sm,
              fontFamily: WEIGHT.regular,
              textAlignVertical: 'center',
              color: colors.pri,
            }}>
            Font Scaling{'\n'}
            <Text
              style={{
                fontSize: SIZE.xs,
                color: colors.icon,
              }}>
              Scale the size of text in the app.
            </Text>
          </Text>

          <View
            style={{
              flexDirection: 'row',
              overflow: 'hidden',
              borderRadius: 5,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            {[
              {
                title: '0.9x',
                value: 0.9,
              },
              {
                title: '1.0x',
                value: 1,
              },
              {
                title: '1.2x',
                value: 1.2,
              },
              {
                title: '1.5x',
                value: 1.5,
              },
            ].map((item) => (
              <TouchableOpacity
                activeOpacity={1}
                onPress={async () => {
                  await setSetting(settings, 'fontScale', item.value);
                  eSendEvent(eResetApp);
                }}
                key={item.title}
                style={{
                  backgroundColor:
                    settings.fontScale === item.value
                      ? colors.accent
                      : colors.nav,
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 20,
                  paddingHorizontal: 5,
                }}>
                <Text
                  style={{
                    color:
                      settings.fontScale === item.value ? 'white' : colors.icon,
                    fontSize: SIZE.xs,
                  }}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {DDS.isTab ? (
          <CustomButton
            title="Force portrait mode"
            onPress={async () => {
              await setSetting(
                settings,
                'forcePortraitOnTablet',
                !settings.forcePortraitOnTablet,
              );
            }}
            customComponent={
              <Icon
                size={SIZE.xl}
                color={
                  settings.forcePortraitOnTablet ? colors.accent : colors.icon
                }
                name={
                  settings.forcePortraitOnTablet
                    ? 'toggle-switch'
                    : 'toggle-switch-off'
                }
              />
            }
          />
        ) : null}

        <SectionHeader title="Backup & Restore" />

        {backupItemsList.map((item) => (
          <CustomButton
            key={item.name}
            title={item.name}
            tagline={item.desc}
            onPress={item.func}
          />
        ))}

        <View
          style={{
            width: '100%',
            marginHorizontal: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 50,
            paddingHorizontal: 12,
          }}>
          <Text
            style={{
              fontSize: SIZE.sm,
              fontFamily: WEIGHT.regular,
              textAlignVertical: 'center',
              color: colors.pri,
            }}>
            Auto Backup{'\n'}
            <Text
              style={{
                fontSize: SIZE.xs,
                color: colors.icon,
              }}>
              Backup your data automatically.
            </Text>
          </Text>

          <View
            style={{
              flexDirection: 'row',
              overflow: 'hidden',
              borderRadius: 5,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            {[
              {
                title: 'Daily',
                value: 'daily',
              },
              {
                title: 'Weekly',
                value: 'weekly',
              },
            ].map((item) => (
              <TouchableOpacity
                activeOpacity={1}
                onPress={async () => {
                  await setSetting(settings, 'reminder', item.value);
                }}
                key={item.value}
                style={{
                  backgroundColor:
                    settings.reminder === item.value
                      ? colors.accent
                      : colors.nav,
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: 60,
                  height: 20,
                }}>
                <Text
                  style={{
                    color:
                      settings.reminder === item.value ? 'white' : colors.icon,
                    fontSize: SIZE.xs,
                  }}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <CustomButton
          title="Encrypted Backups"
          tagline="Encrypt your data before backup"
          onPress={async () => {
            if (!user || !user.id) {
              ToastEvent.show(
                'You must login to enable encryption',
                'error',
                'global',
                6000,
                () => {
                  NavigationService.navigate('Login', {
                    root: true,
                  });
                },
                'Login',
              );
              return;
            }
            await setSetting(
              settings,
              'encryptedBackup',
              !settings.encryptedBackup,
            );
          }}
          customComponent={
            <Icon
              size={SIZE.xl}
              color={settings.encryptedBackup ? colors.accent : colors.icon}
              name={
                settings.encryptedBackup ? 'toggle-switch' : 'toggle-switch-off'
              }
            />
          }
        />

        <SectionHeader title="Other" />

        {[
          {
            name: 'Privacy Policy',
            func: () => {
              Linking.openURL('https://www.notesnook.com/privacy.html');
            },
            desc: 'Read our privacy policy',
          },
          {
            name: 'Check for updates',
            func: () => {
              Linking.openURL('https://www.notesnook.com/privacy.html');
            },
            desc: 'Check for a newer version of app',
          },
          {
            name: 'About',
            func: () => {
              Linking.openURL('https://www.notesnook.com');
            },
            desc: 'You are using the latest version of our app.',
          },
        ].map((item) => (
          <CustomButton
            key={item.name}
            title={item.name}
            tagline={item.desc}
            onPress={item.func}
          />
        ))}
        <Seperator />
      </ScrollView>
    </Animatable.View>
  );
};

export default Settings;
