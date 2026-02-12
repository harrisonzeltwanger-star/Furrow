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

// Stack param types
export type DashboardStackParamList = { Dashboard: undefined };
export type ListingsStackParamList = {
  ListingsList: undefined;
  ListingDetail: { listingId: string };
  CreateListing: undefined;
};
export type POsStackParamList = {
  ActivePOs: undefined;
  PODetail: { poId: string };
  LogDelivery: { poId: string };
};
export type LoadsStackParamList = { Loads: undefined };
export type MoreStackParamList = {
  MoreMenu: undefined;
  Negotiations: undefined;
  NegotiationThread: { threadId: string };
  Contracts: undefined;
  ContractDetail: { poId: string };
  Account: undefined;
  Team: undefined;
};

const Tab = createBottomTabNavigator();

// Individual stacks
const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#faf8f4' }, headerTintColor: '#3a2a1a' }}>
      <DashboardStack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
    </DashboardStack.Navigator>
  );
}

const ListingsStack = createNativeStackNavigator<ListingsStackParamList>();
function ListingsStackScreen() {
  return (
    <ListingsStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#faf8f4' }, headerTintColor: '#3a2a1a' }}>
      <ListingsStack.Screen name="ListingsList" component={ListingsScreen} options={{ title: 'Listings' }} />
      <ListingsStack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Listing Detail' }} />
      <ListingsStack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'New Listing' }} />
    </ListingsStack.Navigator>
  );
}

const POsStack = createNativeStackNavigator<POsStackParamList>();
function POsStackScreen() {
  return (
    <POsStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#faf8f4' }, headerTintColor: '#3a2a1a' }}>
      <POsStack.Screen name="ActivePOs" component={ActivePOsScreen} options={{ title: 'Active POs' }} />
      <POsStack.Screen name="PODetail" component={PODetailScreen} options={{ title: 'PO Detail' }} />
      <POsStack.Screen name="LogDelivery" component={LogDeliveryScreen} options={{ title: 'Log Delivery' }} />
    </POsStack.Navigator>
  );
}

const LoadsStack = createNativeStackNavigator<LoadsStackParamList>();
function LoadsStackScreen() {
  return (
    <LoadsStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#faf8f4' }, headerTintColor: '#3a2a1a' }}>
      <LoadsStack.Screen name="Loads" component={LoadsScreen} options={{ title: 'Loads' }} />
    </LoadsStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator<MoreStackParamList>();
function MoreStackScreen() {
  return (
    <MoreStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#faf8f4' }, headerTintColor: '#3a2a1a' }}>
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Negotiations" component={NegotiationsScreen} options={{ title: 'Negotiations' }} />
      <MoreStack.Screen name="NegotiationThread" component={NegotiationThreadScreen} options={{ title: 'Negotiation' }} />
      <MoreStack.Screen name="Contracts" component={ContractsScreen} options={{ title: 'Contracts' }} />
      <MoreStack.Screen name="ContractDetail" component={ContractDetailScreen} options={{ title: 'Contract' }} />
      <MoreStack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      <MoreStack.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
    </MoreStack.Navigator>
  );
}

// Simple "More" menu screen
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';

function MoreMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { user, logout } = useAuth();

  const items = [
    { label: 'Negotiations', screen: 'Negotiations' as const },
    { label: 'Contracts', screen: 'Contracts' as const },
    { label: 'Account', screen: 'Account' as const },
    { label: 'Team', screen: 'Team' as const },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#faf8f4' }}>
      <View style={{ padding: 16 }}>
        {/* User info */}
        <View style={{ backgroundColor: '#fdfcf8', borderRadius: 12, borderWidth: 1, borderColor: '#d8cebb', padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#3a2a1a' }}>{user?.name}</Text>
          <Text style={{ fontSize: 13, color: '#7a6a5a', marginTop: 2 }}>{user?.email}</Text>
          <Text style={{ fontSize: 13, color: '#7a6a5a', marginTop: 2 }}>{user?.organizationName} ({user?.role})</Text>
        </View>

        {items.map((item) => (
          <TouchableOpacity
            key={item.screen}
            onPress={() => navigation.navigate(item.screen)}
            style={{
              backgroundColor: '#fdfcf8',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#d8cebb',
              padding: 16,
              marginBottom: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, color: '#3a2a1a' }}>{item.label}</Text>
            <Text style={{ color: '#a09080' }}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={logout}
          style={{
            backgroundColor: '#fde8e8',
            borderRadius: 10,
            padding: 16,
            marginTop: 24,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: '#b33a1a', fontWeight: '600' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Tab icon helper
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '◻',
    Listings: '📋',
    POs: '📦',
    Loads: '🚛',
    More: '⋯',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '•'}
    </Text>
  );
}

export default function PhoneTabNavigator() {
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
      <Tab.Screen name="Dashboard" component={DashboardStackScreen} />
      <Tab.Screen name="Listings" component={ListingsStackScreen} />
      <Tab.Screen name="POs" component={POsStackScreen} />
      <Tab.Screen name="Loads" component={LoadsStackScreen} />
      <Tab.Screen name="More" component={MoreStackScreen} />
    </Tab.Navigator>
  );
}
