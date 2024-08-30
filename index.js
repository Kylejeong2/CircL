import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from "react-native-background-fetch";
import BackgroundGeolocation from "@mauron85/react-native-background-geolocation";

const backgroundFetchHeadlessTask = async (event) => {
  if (event.timeout) {
    console.log('[BackgroundFetch] Headless TIMEOUT:', event.timeout);
    BackgroundFetch.finish(event.taskId);
    return;
  }
  
  console.log('[BackgroundFetch] Headless task executed.');
  
  // Implement your background fetch logic here
  
  BackgroundFetch.finish(event.taskId);
};

BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

AppRegistry.registerComponent(appName, () => App);