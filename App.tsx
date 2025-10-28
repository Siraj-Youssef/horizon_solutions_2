import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import TelaSplash from './src/screens/TelaSplash';
import SystemScreen from './src/screens/SystemScreen';

const Stack = createNativeStackNavigator();
const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions= {{headerShown: false}} initialRouteName="TelaSplash">
        <Stack.Screen name="TelaSplash" component={TelaSplash} />
        <Stack.Screen name="SystemScreen" component={SystemScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
export default App

const styles = StyleSheet.create({})