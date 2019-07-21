/* @flow */

import * as React from 'react';
import { Button, Col, Input, Label } from 'reactstrap';

type Props = {
  onDeletePortfolio: () => void,
  onDownloadPortfolio: () => void,
  onGetCodeFromTD: () => void,
  onGetTokenFromTD: () => void,
  onImportFromTD: () => void,
  onImportPortfolio: (file: Blob) => void,
};

export default function PortfolioActions(props: Props) {
  const handleImportTransactions = (event: SyntheticEvent<HTMLInputElement>) => {
    const currentTarget = event.currentTarget;
    const files = currentTarget.files;
    if (files == null || files.length === 0) return;
    props.onImportPortfolio(files[0]);

    // Reset the input so the same file can be uploaded multiple times in a row (without
    // resetting the `onchange` would not fire). Why upload multiple times? Testing testing
    // testing. ABT: Always Be Testing.
    currentTarget.value = '';
  };

  return (
    <Col className="text-right">
      <Button color="black" size="sm">
        Import transactions from TD Ameritrade
      </Button>
      <Button color="link" onClick={props.onGetCodeFromTD} size="sm" type="button">
        Login
      </Button>
      |
      <Button color="link" onClick={props.onGetTokenFromTD} size="sm" type="button">
        Authorize
      </Button>
      |
      <Button color="link" onClick={props.onImportFromTD} size="sm" type="button">
        Fetch
      </Button>
      <br></br>
      <Button color="link" size="sm" type="button">
        <Label className="label-button">
          <Input accept="text/csv" hidden onChange={handleImportTransactions} type="file" />
          Import transactions
        </Label>
      </Button>
      |
      <Button color="link" onClick={props.onDeletePortfolio} size="sm" type="button">
        Delete portfolio
      </Button>
      |
      <Button color="link" onClick={props.onDownloadPortfolio} size="sm" type="button">
        Download to spreadsheet
      </Button>
    </Col>
  );
}
