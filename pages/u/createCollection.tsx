import React from 'react';
import { Default } from 'components/layouts/Default';
import CreateCollection from 'components/containers/dashboard/CreateCollection';

const CreateCollectionPage = () => {
  return (
    <Default pageName="Nouvelle Collection">
      <CreateCollection />
    </Default>
  );
};

export default CreateCollectionPage;
