import { type LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes: ['furrow://', 'https://furrowag.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          AcceptInvite: 'accept-invite',
        },
      },
    },
  },
};
