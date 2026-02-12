import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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

const Drawer = createDrawerNavigator();

// Stack wrappers for screens that need push navigation
const ListingsStack = createNativeStackNavigator();
function ListingsStackScreen() {
  return (
    <ListingsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListingsStack.Screen name="ListingsList" component={ListingsScreen} />
      <ListingsStack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <ListingsStack.Screen name="CreateListing" component={CreateListingScreen} />
    </ListingsStack.Navigator>
  );
}

const POsStack = createNativeStackNavigator();
function POsStackScreen() {
  return (
    <POsStack.Navigator screenOptions={{ headerShown: false }}>
      <POsStack.Screen name="ActivePOs" component={ActivePOsScreen} />
      <POsStack.Screen name="PODetail" component={PODetailScreen} />
      <POsStack.Screen name="LogDelivery" component={LogDeliveryScreen} />
    </POsStack.Navigator>
  );
}

const NegotiationsStack = createNativeStackNavigator();
function NegotiationsStackScreen() {
  return (
    <NegotiationsStack.Navigator screenOptions={{ headerShown: false }}>
      <NegotiationsStack.Screen name="NegotiationsList" component={NegotiationsScreen} />
      <NegotiationsStack.Screen name="NegotiationThread" component={NegotiationThreadScreen} />
    </NegotiationsStack.Navigator>
  );
}

const ContractsStack = createNativeStackNavigator();
function ContractsStackScreen() {
  return (
    <ContractsStack.Navigator screenOptions={{ headerShown: false }}>
      <ContractsStack.Screen name="ContractsList" component={ContractsScreen} />
      <ContractsStack.Screen name="ContractDetail" component={ContractDetailScreen} />
    </ContractsStack.Navigator>
  );
}

const AccountStack = createNativeStackNavigator();
function AccountStackScreen() {
  return (
    <AccountStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountStack.Screen name="AccountMain" component={AccountScreen} />
      <AccountStack.Screen name="Team" component={TeamScreen} />
    </AccountStack.Navigator>
  );
}

export default function TabletDrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerType: 'permanent',
        drawerStyle: {
          backgroundColor: '#f5f0e8',
          width: 240,
        },
        headerStyle: { backgroundColor: '#faf8f4' },
        headerTintColor: '#3a2a1a',
        drawerActiveTintColor: '#2d5a27',
        drawerInactiveTintColor: '#5a4a3a',
        sceneStyle: { backgroundColor: '#faf8f4' },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Listings" component={ListingsStackScreen} />
      <Drawer.Screen name="Active POs" component={POsStackScreen} />
      <Drawer.Screen name="Loads" component={LoadsScreen} />
      <Drawer.Screen name="Negotiations" component={NegotiationsStackScreen} />
      <Drawer.Screen name="Contracts" component={ContractsStackScreen} />
      <Drawer.Screen name="Account" component={AccountStackScreen} />
    </Drawer.Navigator>
  );
}
