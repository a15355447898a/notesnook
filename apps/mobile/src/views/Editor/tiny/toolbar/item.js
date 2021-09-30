import React, {useEffect, useState} from 'react';
import {Platform} from 'react-native';
import {View, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {PressableButton} from '../../../../components/PressableButton';
import Heading from '../../../../components/Typography/Heading';
import Paragraph from '../../../../components/Typography/Paragraph';
import {useTracked} from '../../../../provider';
import {
  eSubscribeEvent,
  eUnSubscribeEvent,
  eSendEvent,
  ToastEvent
} from '../../../../services/EventManager';
import PremiumService from '../../../../services/PremiumService';
import {editing, showTooltip, TOOLTIP_POSITIONS} from '../../../../utils';
import {db} from '../../../../utils/DB';
import {eShowGetPremium} from '../../../../utils/Events';
import {MMKV} from '../../../../utils/mmkv';
import {normalize, SIZE} from '../../../../utils/SizeUtils';
import {sleep} from '../../../../utils/TimeUtils';
import {EditorWebView} from '../../Functions';
import tiny, {safeKeyboardDismiss} from '../tiny';
import {execCommands} from './commands';
import {
  focusEditor,
  formatSelection,
  properties,
  TOOLBAR_ICONS,
  rgbToHex,
  font_names
} from './constants';
import ToolbarItemPin from './itempin';
import ToolbarListFormat from './listformat';

const ToolbarItem = ({
  format,
  type,
  showTitle,
  premium,
  valueIcon,
  group,
  groupFormat,
  groupDefault,
  value,
  groupType,
  text,
  formatValue,
  fullname
}) => {
  const [state] = useTracked();
  const {colors} = state;
  const [selected, setSelected] = useState(false);
  const [icon, setIcon] = useState(valueIcon);
  const [color, setColor] = useState(null);
  const [currentText, setCurrentText] = useState(null);

  useEffect(() => {
    if (/^(dhilitecolor|dforecolor)$/.test(format)) return;
    eSubscribeEvent('onSelectionChange', onSelectionChange);
    return () => {
      eUnSubscribeEvent('onSelectionChange', onSelectionChange);
    };
  }, [selected]);

  useEffect(() => {
    if (/^(dhilitecolor|dforecolor)$/.test(format)) return;
    onSelectionChange(properties.selection, true);
  }, []);

  useEffect(() => {
    if (/^(dhilitecolor|dforecolor)$/.test(format)) {
      onColorChange();
      eSubscribeEvent('onColorChange', onColorChange);
    }
    return () => {
      eUnSubscribeEvent('onColorChange', onColorChange);
    };
  }, []);

  const onColorChange = async () => {
    console.log('color change');
    if (/^(dhilitecolor|dforecolor)$/.test(format)) {
      let _color = await MMKV.getItem(format);
      let defColor =
        format === 'dhilitecolor' ? colors.accent + '60' : colors.accent;
      setColor(_color || defColor);
    }
  };

  const checkForChanges = data => {
    properties.selection = data;
    let formats = Object.keys(data);
    if (!data['link'] && type === 'tooltip') {
      if (editing.tooltip) {
        eSendEvent('showTooltip');
      }
    }

    if (format === 'header' && type === 'tooltip') {
      let keys = group.map(i => i.format);
      keys.forEach(k => {
        if (formats.includes(k)) {
          setCurrentText(group.find(e => e.format === k).text);
          setSelected(false);
        }
      });
      return;
    }

    if (formats.indexOf(format) > -1 && format !== 'removeformat') {
      if (format === 'forecolor' || format === 'hilitecolor') {
        if (!data[format]) {
          setSelected(false);
          return;
        }
        if (data[format]?.startsWith('#')) {
          setColor(data[format]);
        } else {
          setColor(rgbToHex(data[format]));
        }
      }

      if (format === 'fontname' && data[format].includes('times new')) {
        data[format] = 'times new roman';
      }

      if (format === 'fontname' && data[format].includes('courier new')) {
        data[format] = 'courier new';
      }

      if (format === 'link') {
        properties.selection = data;
        if (!data['link']) return;

        properties.pauseSelectionChange = true;
        eSendEvent('showTooltip', {
          data: null,
          value: data['link'],
          type: 'link'
        });
        return;
      }

      if (
        (format === 'fontsize' ||
          format === 'ul' ||
          format === 'ol' ||
          format === 'fontname') &&
        data[format] !== '' &&
        formatValue === data[format]
      ) {
        setSelected(true);
        return;
      }

      if (format === 'fontname' && formatValue === data[format]) {
        setSelected(true);
        return;
      }

      if ((format === 'ul' || format === 'ol') && type === 'tooltip') {
        setIcon(data[format]);
        setSelected(true);
        return;
      }

      if (format === 'fontname' && type === 'tooltip') {
        font_names.forEach(font => {
          if (font.value === data[format]) {
            setCurrentText(font.name);
            setIcon(font.value);
          }
        });
        setSelected(false);
        return;
      }

      if (format === 'fontsize' && type === 'tooltip') {
        setCurrentText(data[format]);
        setSelected(false);
        return;
      }
      if (
        format === 'fontsize' ||
        format === 'fontname' ||
        format === 'ol' ||
        format === 'ul'
      ) {
        setSelected(false);
        return;
      }
      setSelected(true);
      return;
    }

    setSelected(false);

    if (valueIcon && group) {
      setIcon(valueIcon);
    }
    if (format === 'forecolor' || format === 'hilitecolor') {
      setColor(null);
    }
  };

  const onSelectionChange = (data, isLocal) => {
    if (properties.pauseSelectionChange && !isLocal) return;

    checkForChanges(data);
  };

  const onPress = async event => {
    if (premium && !PremiumService.get()) {
      let user = await db.user.getUser();
      if (user && !user.isEmailConfirmed) {
        if (editing.isFocused) {
          safeKeyboardDismiss();
          await sleep(500);
          editing.isFocused = true;
        }
        PremiumService.showVerifyEmailDialog();
      } else {
        eSendEvent(eShowGetPremium, {
          context: 'editor',
          title: 'Get Notesnook Pro',
          desc: 'Enjoy Full Rich Text Editor with Markdown Support!'
        });
      }
      return;
    }
    if (type === 'settings') {
      if (editing.isFocused) {
        safeKeyboardDismiss();
        await sleep(500);
        editing.isFocused = true;
      }
      eSendEvent('openEditorSettings');
      return;
    }

    if (editing.tooltip === format && !formatValue) {
      focusEditor(format);
      eSendEvent('showTooltip');

      properties.pauseSelectionChange = false;
      return;
    }

    if (
      (format === 'link' && properties.selection.current?.length === 0) ||
      !properties.selection
    ) {
      ToastEvent.show({
        heading: 'No selection',
        message: 'Select some text before adding a link.',
        type: 'error'
      });
      return;
    }

    if (format === 'link' || format === 'video') {
      pauseSelectionChange = true;
      formatSelection(`current_selection_range = editor.selection.getRng();`);
    }

    if (type === 'tooltip') {
      properties.pauseSelectionChange = true;
      eSendEvent('showTooltip', {
        data: group,
        title: format,
        default: valueIcon,
        type: groupType,
        pageX: event.nativeEvent.pageX
      });
      return;
    }

    if (format === 'image') {
      await execCommands.image();
      return;
    }

    let value;
    if (
      groupFormat === 'fontsize' ||
      groupFormat === 'fontname' ||
      groupFormat === 'ol' ||
      groupFormat === 'ul'
    ) {
      if (groupFormat === 'fontname' && formatValue === '') {
        value = Platform.OS === 'ios' ? '-apple-system' : 'serif';
      } else {
        value = formatValue;
      }
    }

    if (/^(dhilitecolor|dforecolor)$/.test(format)) {
      value = color;
    }

    if (format === 'pre') {
      if (selected) {
        formatSelection(tiny.pre);
        focusEditor(format);
        return;
      } else {
        value = null;
      }
    }

    if (selected && (format === 'ol' || format === 'ul' || format === 'cl')) {
      formatSelection(execCommands.removeList);
    } else if (value || value === '') {
      formatSelection(execCommands[format](value));
    } else {
      formatSelection(execCommands[format]);
    }

    focusEditor(format);
    editing.tooltip = null;
  };
  return (
    <View>
      <PressableButton
        type={selected && !color ? 'shade' : 'transparent'}
        customOpacity={0.12}
        onLongPress={event => {
          showTooltip(event, fullname, TOOLTIP_POSITIONS.TOP);
        }}
        onPress={e => onPress(e)}
        customStyle={{
          borderRadius: 0,
          justifyContent: 'center',
          alignItems: 'center',
          height: normalize(50),
          minWidth: /^(dhilitecolor|dforecolor)$/.test(format) ? 30 : 60
        }}>
        {/^(dhilitecolor|dforecolor)$/.test(format) ? (
          <View
            style={{
              backgroundColor: color,
              height: 30,
              width: 30,
              marginLeft: 10,
              borderRadius: 2.5
            }}
          />
        ) : (
          <>
            {type === 'tooltip' && (
              <ToolbarItemPin format={format} color={selected && color} />
            )}

            {/^(h1|h2|h3|h4|h5|h6|p)$/.test(format) ? (
              <Heading
                size={SIZE.md + 2}
                color={selected ? colors.accent : colors.pri}>
                {format.slice(0, 1).toUpperCase() + format.slice(1)}
              </Heading>
            ) : /^(ol|ul|cl)$/.test(format) ? (
              <ToolbarListFormat
                format={format}
                selected={selected}
                formatValue={formatValue || icon || 'default'}
              />
            ) : format === 'fontsize' ? (
              <Paragraph
                size={SIZE.md}
                color={selected ? colors.accent : colors.pri}>
                {formatValue || currentText || '12pt'}
              </Paragraph>
            ) : text && groupFormat !== 'header' ? (
              <Paragraph
                color={selected ? colors.accent : colors.pri}
                style={{
                  paddingHorizontal: 12,
                  fontFamily:
                    format === 'fontname' &&
                    formatValue
                      ? formatValue === 'open sans' ? "OpenSans-Regular" : formatValue
                      : 'OpenSans-Regular'
                }}
                size={text.includes('%') ? SIZE.sm : SIZE.md}>
                {currentText || text}
              </Paragraph>
            ) : (
              <Icon
                name={
                  valueIcon
                    ? TOOLBAR_ICONS[icon || valueIcon]
                    : TOOLBAR_ICONS[format === '' ? groupDefault : format]
                }
                size={SIZE.xl}
                allowFontScaling={false}
                color={selected ? (color ? color : colors.accent) : colors.pri}
              />
            )}

            {type === 'tooltip' && (
              <Icon
                name="menu-right"
                size={SIZE.sm}
                allowFontScaling={false}
                color={colors.icon}
                style={{
                  position: 'absolute',
                  transform: [
                    {
                      rotateZ: '-45deg'
                    }
                  ],
                  top: 0,
                  right: 0
                }}
              />
            )}
          </>
        )}
      </PressableButton>
    </View>
  );
};

export default ToolbarItem;
