import { useDeviceType } from '../hooks/useDeviceType';
import PhoneTabNavigator from './PhoneTabNavigator';
import TabletDrawerNavigator from './TabletDrawerNavigator';

export default function AppNavigator() {
  const { isTablet } = useDeviceType();
  return isTablet ? <TabletDrawerNavigator /> : <PhoneTabNavigator />;
}
