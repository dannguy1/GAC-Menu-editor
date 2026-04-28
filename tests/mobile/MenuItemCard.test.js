/**
 * MenuItemCard component tests. Tests NFR-D03.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import MenuItemCard from '../../mobile/components/MenuItemCard';

const baseItem = {
  item_id: 'honey-walnut-shrimps',
  item_name: 'Honey Walnut Shrimps',
  item_viet: 'Tôm Walnut Mật Ong',
  price: 13.00,
  category: 'Seafood',
  popular: false,
  available: true,
  image_path: null,
  _locationId: 'garden-grove',
};

test('renders item name', () => {
  const { getByText } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(getByText('Honey Walnut Shrimps')).toBeTruthy();
});

test('renders price correctly', () => {
  const { getByText } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(getByText('$13.00')).toBeTruthy();
});

test('renders Vietnamese name', () => {
  const { getByText } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(getByText('Tôm Walnut Mật Ong')).toBeTruthy();
});

test('shows popular badge when popular is true', () => {
  const popularItem = { ...baseItem, popular: true };
  const { getByText } = render(
    <MenuItemCard item={popularItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(getByText('⭐ POPULAR')).toBeTruthy();
});

test('does not show popular badge when popular is false', () => {
  const { queryByText } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(queryByText('⭐ POPULAR')).toBeNull();
});

test('calls onPress with item when tapped', () => {
  const onPress = jest.fn();
  const { UNSAFE_getAllByType } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={onPress} />
  );
  const { TouchableOpacity } = require('react-native');
  const touchables = UNSAFE_getAllByType(TouchableOpacity);
  touchables[0].props.onPress();
  expect(onPress).toHaveBeenCalledWith(baseItem);
});

test('renders placeholder when no image_path', () => {
  const { getByText } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(getByText('🍽')).toBeTruthy();
});

test('renders category', () => {
  const { getByText } = render(
    <MenuItemCard item={baseItem} serverHost="http://localhost:8100" onPress={jest.fn()} />
  );
  expect(getByText('Seafood')).toBeTruthy();
});
