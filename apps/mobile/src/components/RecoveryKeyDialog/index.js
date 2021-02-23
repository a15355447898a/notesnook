import React, {createRef} from 'react';
import { Platform } from 'react-native';
import {Clipboard, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Share from 'react-native-share';
import {LOGO_BASE64} from '../../assets/images/assets';
import {
  eSendEvent,
  eSubscribeEvent,
  eUnSubscribeEvent,
  ToastEvent,
} from '../../services/EventManager';
import {db} from '../../utils/DB';
import {eOpenRecoveryKeyDialog, eOpenResultDialog} from '../../utils/Events';
import {SIZE} from '../../utils/SizeUtils';
import Storage from '../../utils/storage';
import {sleep} from '../../utils/TimeUtils';
import ActionSheetWrapper from '../ActionSheetComponent/ActionSheetWrapper';
import {Button} from '../Button';
import DialogHeader from '../Dialog/dialog-header';
import Seperator from '../Seperator';
import {Toast} from '../Toast';
import Paragraph from '../Typography/Paragraph';

let RNFetchBlob;

class RecoveryKeyDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      key: null,
      visible: false,
    };
    this.actionSheetRef = createRef();
    this.svg = createRef();
    this.user;
    this.signup = false;
    this.tapCount = 0;
  }

  open = (signup) => {
    if (signup) {
      this.signup = true;
    }
    this.setState(
      {
        visible: true,
      },
      () => {
        this.actionSheetRef.current?.setModalVisible(true);
      },
    );
  };

  close = () => {
    if (this.tapCount === 0) {
      ToastEvent.show({
        heading: 'Did you save recovery key?',
        message: 'Tap one more time to confirm.',
        type: 'success',
        context: 'local',
      });
      this.tapCount++;
      return;
    }
    this.tapCount = 0;
    this.actionSheetRef.current?.setModalVisible(false);
    sleep(200).then(() => {
      this.setState({
        visible: false,
      });
    });
    if (this.signup) {
      setTimeout(() => {
        eSendEvent(eOpenResultDialog, {
          title: 'Welcome!',
          paragraph: 'Please verify your email to activate syncing.',
          icon: 'check',
          button: 'Thank You!',
        });
      }, 500);
    }
  };
  async componentDidMount() {
    eSubscribeEvent(eOpenRecoveryKeyDialog, this.open);
  }

  async componentWillUnmount() {
    eUnSubscribeEvent(eOpenRecoveryKeyDialog, this.open);
  }

  saveQRCODE = async () => {
    if ((await Storage.requestPermission()) === false) {
      ToastEvent.show({
        heading: 'Storage access not granted',
        message: 'You must provide access to phone storage to save QR-Code',
        type: 'error',
        context: 'local',
      });
      return;
    }

    this.svg.current?.toDataURL(async (data) => {
      let path = await Storage.checkAndCreateDir('/');
      RNFetchBlob = require('rn-fetch-blob').default;
      let fileName = 'nn_' + this.user.email + '_recovery_key_qrcode.png';
      RNFetchBlob.fs.writeFile(path + fileName, data, 'base64').then((res) => {
        RNFetchBlob.fs
          .scanFile([
            {
              path: path + fileName,
              mime: 'image/png',
            },
          ])
          .then((r) => {
            ToastEvent.show({
              heading: 'Recovery key QR-Code saved',
              message:
                'QR-Code image has been saved to Gallery at ' + path + fileName,
              type: 'success',
              context: 'local',
            });
          });
      });
    });
  };

  saveToTextFile = async () => {
    if ((await Storage.requestPermission()) === false) {
      ToastEvent.show({
        heading: 'Storage access not granted',
        message:
          'You must provide access to phone storage to save recovery key text file.',
        type: 'error',
        context: 'local',
      });
      return;
    }
    try {
      let path = await Storage.checkAndCreateDir('/');
      let fileName = 'nn_' + this.user?.email + '_recovery_key.txt';
      RNFetchBlob = require('rn-fetch-blob').default;
      await RNFetchBlob.fs.writeFile(path + fileName, this.state.key, 'utf8');
      ToastEvent.show({
        heading: 'Recovery key text file saved',
        message: 'Recovery key saved in text file at ' + path + fileName,
        type: 'success',
        context: 'local',
      });
      return path + fileName;
    } catch (e) {
      alert(e.message);
    }
  };

  onOpen = async () => {
    let k = await db.user.getEncryptionKey();
    this.user = await db.user.getUser();
    if (k) {
      this.setState({
        key: k.key,
      });
    }
  };

  shareFile = async () => {
    let path = await this.saveToTextFile();
    if (!path) return;
    try {
      await Share.open({
        url: Platform.OS === "ios" ? path : 'file:/' + path,
        title: 'Save recovery key to cloud',
        failOnCancel: false,
      });
    } catch (e) {}
  };

  render() {
    const {colors} = this.props;
    if (!this.state.visible) return null;
    return (
      <ActionSheetWrapper
        closeOnTouchBackdrop={false}
        gestureEnabled={false}
        onOpen={this.onOpen}
        fwdRef={this.actionSheetRef}>
        <View
          style={{
            width: '100%',
            backgroundColor: colors.bg,
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            borderRadius: 10,
            paddingTop: 10,
          }}>
          <DialogHeader
            title="Your data recovery key"
            paragraph="If you forget your password, you can recover your
            data and reset your password only using this recovery key."
          />

          <View
            style={{
              backgroundColor: colors.nav,
              borderRadius: 5,
              padding: 10,
              marginTop: 10,
            }}>
            <Paragraph
              color={colors.icon}
              size={SIZE.md}
              numberOfLines={2}
              style={{
                width: '100%',
                maxWidth: '100%',
                paddingRight: 10,
                marginBottom: 10,
              }}>
              {this.state.key}
            </Paragraph>

            <Button
              onPress={() => {
                Clipboard.setString(this.state.key);
                ToastEvent.show({
                  heading: 'Recovery key copied!',
                  type: 'success',
                  context: 'local',
                });
              }}
              icon="content-copy"
              title="Copy to clipboard"
              width="100%"
              type="gray"
              fontSize={SIZE.md}
              height={50}
            />
          </View>
          <Seperator />

          <View
            style={{
              alignSelf: 'center',
              marginBottom: 15,
              flexDirection: 'row',
              width: '100%',
              justifyContent: 'center',
              position: 'absolute',
              opacity: 0,
              zIndex: -1,
            }}>
            {this.state.key ? (
              <QRCode
                getRef={this.svg}
                size={500}
                value={this.state.key}
                logo={{uri: LOGO_BASE64}}
                logoBorderRadius={10}
              />
            ) : null}
          </View>

          <Button
            title="Save QR-Code to gallery"
            onPress={this.saveQRCODE}
            width="100%"
            type="accent"
            fontSize={SIZE.md}
            height={50}
          />
          <Seperator />
          <Button
            onPress={this.saveToTextFile}
            title="Save to text file"
            width="100%"
            type="accent"
            fontSize={SIZE.md}
            height={50}
          />
          <Seperator />

          <Button
            onPress={this.shareFile}
            title="Share to Cloud"
            width="100%"
            type="accent"
            fontSize={SIZE.md}
            height={50}
          />
          <Seperator />

          <Button
            title="I have saved the key."
            width="100%"
            height={50}
            type="error"
            fontSize={SIZE.md}
            onPress={this.close}
          />
        </View>
      </ActionSheetWrapper>
    );
  }
}

export default RecoveryKeyDialog;
