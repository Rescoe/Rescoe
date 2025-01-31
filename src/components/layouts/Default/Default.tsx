import { FC, ReactNode } from 'react';
import { Container } from '@chakra-ui/react';
import { Footer } from '../../modules/Footer';
import { Header } from '../../modules/Header';

import Head from 'next/head';

const Default: FC<{ children: ReactNode; pageName: string }> = ({ children, pageName }) => (
  <>
    <Head>
      <title>{`${pageName} | Rescoe`}</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <Header />
    <Container maxW="container.xl" p={3} as="main" minH="70vh">
      {children}
    </Container>
    <Footer />
  </>
);

export default Default;
