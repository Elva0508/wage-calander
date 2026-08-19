import { ThemedText } from "@/components/themed-text";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from "react";
import { Button } from "react-native";
import {
    SafeAreaView
} from 'react-native-safe-area-context';

export default function TodayScreen() {
  const [date, setDate] = useState(new Date(1598051730000));
  const [mode, setMode] = useState<'date' | 'time'>('date');
  const [show, setShow] = useState(false);

  const showMode = (currentMode: 'date' | 'time') => {
    setShow(true);
    setMode(currentMode);
  };

  const showDatepicker = () => {
    showMode('date');
  };

  const showTimepicker = () => {
    showMode('time');
  };

  return (
    <SafeAreaView>
      <Button onPress={showDatepicker} title="Show date picker!" />
      <Button onPress={showTimepicker} title="Show time picker!" />
      <ThemedText>selected: {date.toLocaleString()}</ThemedText>
      {show && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode={mode}
          is24Hour={true}
          onChange={(event, selectedDate) => {
            if (selectedDate) setDate(selectedDate);
            setShow(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}