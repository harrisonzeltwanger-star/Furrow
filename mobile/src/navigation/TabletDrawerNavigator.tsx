import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ListingsScreen from '../screens/listings/ListingsScreen';
import ListingDetailScreen from '../screens/listings/ListingDetailScreen';
import CreateListingScreen from '../screens/listings/CreateListingScreen';
import ActivePOsScreen from '../screens/purchase-orders/ActivePOsScreen';
import PODetailScreen from '../screens/purchase-orders/PODetailScreen';
import LogDeliveryScreen from '../screens/purchase-orders/LogDeliveryScreen';
import LoadsScreen from '../screens/loads/LoadsScreen';
import NegotiationsScreen from '../screens/negotiations/NegotiationsScreen';
import NegotiationThreadScreen from '../screens/negotiations/NegotiationThreadScreen';
import ContractsScreen from '../screens/contracts/ContractsScreen';
import ContractDetailScreen from '../screens/contracts/ContractDetailScreen';
import AccountScreen from '../screens/account/AccountScreen';
import TeamScreen from '../screens/account/TeamScreen';

const Tab = createBottomTabNavigator();

const headerOpts = { headerStyle: { backgroundColor: '#faf8f4' }, headerTintColor: '#3a2a1a' };

// Stack wrappers
const ListingsStack = createNativeStackNavigator();
function ListingsStackScreen() {
  return (
    <ListingsStack.Navigator screenOptions={headerOpts}>
      <ListingsStack.Screen name="ListingsList" component={ListingsScreen} options={{ title: 'Listings' }} />
      <ListingsStack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Listing Detail' }} />
      <ListingsStack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'New Listing' }} />
    </ListingsStack.Navigator>
  );
}

const POsStack = createNativeStackNavigator();
function POsStackScreen() {
  return (
    <POsStack.Navigator screenOptions={headerOpts}>
      <POsStack.Screen name="ActivePOs" component={ActivePOsScreen} options={{ title: 'Active POs' }} />
      <POsStack.Screen name="PODetail" component={PODetailScreen} options={{ title: 'PO Detail' }} />
      <POsStack.Screen name="LogDelivery" component={LogDeliveryScreen} options={{ title: 'Log Delivery' }} />
    </POsStack.Navigator>
  );
}

const NegotiationsStack = createNativeStackNavigator();
function NegotiationsStackScreen() {
  return (
    <NegotiationsStack.Navigator screenOptions={headerOpts}>
      <NegotiationsStack.Screen name="NegotiationsList" component={NegotiationsScreen} options={{ title: 'Negotiations' }} />
      <NegotiationsStack.Screen name="NegotiationThread" component={NegotiationThreadScreen} options={{ title: 'Negotiation' }} />
    </NegotiationsStack.Navigator>
  );
}

const ContractsStack = createNativeStackNavigator();
function ContractsStackScreen() {
  return (
    <ContractsStack.Navigator screenOptions={headerOpts}>
      <ContractsStack.Screen name="ContractsList" component={ContractsScreen} options={{ title: 'Contracts' }} />
      <ContractsStack.Screen name="ContractDetail" component={ContractDetailScreen} options={{ title: 'Contract' }} />
    </ContractsStack.Navigator>
  );
}

const AccountStack = createNativeStackNavigator();
function AccountStackScreen() {
  return (
    <AccountStack.Navigator screenOptions={headerOpts}>
      <AccountStack.Screen name="AccountMain" component={AccountScreen} options={{ title: 'Account' }} />
      <AccountStack.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
    </AccountStack.Navigator>
  );
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '◻',
    Listings: '📋',
    POs: '📦',
    Loads: '🚛',
    Negotiate: '💬',
    Contracts: '✅',
    Account: '👤',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '•'}
    </Text>
  );
}

export default function TabletDrawerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#2d5a27',
        tabBarInactiveTintColor: '#7a6a5a',
        tabBarStyle: { backgroundColor: '#fdfcf8', borderTopColor: '#d8cebb' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, ...headerOpts }} />
      <Tab.Screen name="Listings" component={ListingsStackScreen} />
      <Tab.Screen name="POs" component={POsStackScreen} />
      <Tab.Screen name="Loads" component={LoadsScreen} options={{ headerShown: true, title: 'Loads', ...headerOpts }} />
      <Tab.Screen name="Negotiate" component={NegotiationsStackScreen} />
      <Tab.Screen name="Contracts" component={ContractsStackScreen} />
      <Tab.Screen name="Account" component={AccountStackScreen} />
    </Tab.Navigator>
  );
}
