/* @flow */

import * as React from 'react';
import { Button, Col, Row } from 'reactstrap';
import type { AppSettings, Dispatch, Quote, Transaction } from './types';
import { changePageSize, deleteSymbols } from './actions';
import { currencyFormatter, numberFormatter, percentFormatter } from './formatters';
import { Link } from 'react-router-dom';
import PortfolioContainer from './PortfolioContainer';
import ReactTable from 'react-table';
import { connect } from 'react-redux';
import cx from 'classnames';
import selectTableHOC from 'react-table/lib/hoc/selectTable';

type StateProps = {
  appSettings: AppSettings,
  dispatch: Dispatch,
  quotes: { [symbol: string]: Quote },
  symbols: Array<string>,
  transactions: Array<Transaction>,
};

type Props = StateProps;

type State = {
  selectedSymbols: Set<string>,
  showClosedPosition: boolean,
};

const SelectReactTable = selectTableHOC(ReactTable);

function classes(cell) {
  return cx('text-right', {
    'text-danger': cell != null && cell < 0,
    'text-success': cell != null && cell >= 0,
  });
}

const TABLE_COLUMNS = [
  {
    accessor: 'companyName',
    Cell: props => (props.value == null ? '...' : props.value),
    Footer: <strong>Portfolio value:</strong>,
    Header: 'Name',
    headerClassName: 'text-left',
  },
  {
    accessor: 'symbol',
    Cell: props => <Link to={`/stocks/${props.value}`}>{props.value}</Link>,
    Header: 'Symbol',
    headerClassName: 'text-left',
  },
  {
    accessor: 'latestPrice',
    Cell: props => (
      <div className="text-right">
        {props.value == null ? '...' : currencyFormatter.format(props.value)}
      </div>
    ),
    Header: 'Last Price',
    headerClassName: 'text-right',
  },
  {
    accessor: 'change.change',
    Cell: props => {
      const cell = props.original.change;
      return (
        <div className={classes(props.value)}>
          {cell.change == null
            ? '...'
            : `${cell.change >= 0 ? '+' : ''}${currencyFormatter.format(cell.change)} (${
                cell.changePercent >= 0 ? '+' : ''
              }${percentFormatter.format(cell.changePercent)})`}
        </div>
      );
    },
    Header: 'Change',
    headerClassName: 'text-right',
  },
  {
    accessor: 'shares',
    Cell: props => (
      <div className="text-right">
        {props.value === 0 ? '...' : numberFormatter.format(props.value)}
      </div>
    ),
    Header: 'Shares',
    headerClassName: 'text-right',
  },
  {
    accessor: 'costBasis',
    Cell: props => (
      <div className="text-right">
        {props.value == null ? '...' : currencyFormatter.format(props.value)}
      </div>
    ),
    Header: 'Cost Basis',
    headerClassName: 'text-right',
    Footer: props => (
      <div className="text-right">
        {currencyFormatter.format(
          props.data.reduce((total, current) => total + current.costBasis, 0)
        )}
      </div>
    ),
  },
  {
    accessor: 'marketValue',
    Cell: props => (
      <div className="text-right">
        {props.value == null ? '...' : currencyFormatter.format(props.value)}
      </div>
    ),
    Header: 'Mkt. Value',
    headerClassName: 'text-right',
    Footer: props => (
      <div className="text-right">
        {currencyFormatter.format(
          props.data.reduce((total, current) => total + current.marketValue, 0)
        )}
      </div>
    ),
  },
  {
    accessor: 'gain',
    Cell: props => (
      <div className={classes(props.value)}>
        {props.value == null
          ? '...'
          : `${props.value >= 0 ? '+' : ''}${currencyFormatter.format(props.value)}`}
      </div>
    ),
    Header: 'Gain',
    headerClassName: 'text-right',
    Footer: props => {
      const totalCostBasis = props.data.reduce((total, current) => total + current.costBasis, 0);
      const totalMarketValue = props.data.reduce((total, current) => total + current.marketValue, 0);
      const diff = totalMarketValue - totalCostBasis;
      return (
        <div className={classes(diff)}>
          {diff >= 0 ? '+' : ''}
          {currencyFormatter.format(diff)}
        </div>
      );
    },
  },
  {
    accessor: 'gainPercent',
    Cell: props => (
      <div className={classes(props.value)}>
        {props.value == null
          ? '...'
          : `${props.value >= 0 ? '+' : ''}${percentFormatter.format(props.value)}`}
      </div>
    ),
    Header: 'Gain %',
    headerClassName: 'text-right',
    Footer: props => {
      const totalCostBasis = props.data.reduce((total, current) => total + current.costBasis, 0);
      const totalMarketValue = props.data.reduce((total, current) => total + current.marketValue, 0);
      const diff = totalMarketValue - totalCostBasis;
      const totalGainPercent = totalMarketValue === 0 ? 0 : diff / totalCostBasis;
      return (
        <div className={classes(diff)}>
          {diff >= 0 ? '+' : ''}
          {percentFormatter.format(totalGainPercent)}
        </div>
      );
    },
  },
  {
    accessor: 'daysGain',
    Cell: props => (
      <div className={classes(props.value)}>
        {props.value == null
          ? '...'
          : `${props.value >= 0 ? '+' : ''}${currencyFormatter.format(props.value)}`}
      </div>
    ),
    Footer: props => {
      const totalDaysGain = props.data.reduce((total, current) => total + current.daysGain, 0);
      return (
        <div className={classes(totalDaysGain)}>
          {totalDaysGain >= 0 ? '+' : ''}
          {currencyFormatter.format(totalDaysGain)}
        </div>
      );
    },
    Header: "Day's gain",
    headerClassName: 'text-right',
  },
];

class Performance extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    // If any currently selected symbols are not in the next props update, remove them from the
    // internal selected symbols `Set` to stay up-to-date.
    let hasChanges = false;
    const nextSymbols = new Set(nextProps.symbols);
    const nextSelectedSymbols = new Set<string>();
    for (const symbol of prevState.selectedSymbols) {
      if (nextSymbols.has(symbol)) nextSelectedSymbols.add(symbol);
      else hasChanges = true;
    }

    if (hasChanges) return { selectedSymbols: nextSelectedSymbols };
    else return null;
  }

  constructor(props: Props) {
    super(props);
    this.state = {
      // This is *not* treated as immutable. Object identity will not always correctly indicate
      // when changes are made.
      selectedSymbols: new Set(),
      showClosedPosition: false,
    };
  }

  handleToggleClosedPosition = () => {
    this.setState({ showClosedPosition: !!!this.state.showClosedPosition });
  };

  handleDeleteSelectedSymbols = () => {
    this.props.dispatch(deleteSymbols(Array.from(this.state.selectedSymbols)));
  };

  handlePageSizeChange = (nextPageSize: number) => {
    this.props.dispatch(changePageSize(nextPageSize));
  };

  handleToggleAllSymbols = (isSelected: boolean) => {
    if (this.isAllSymbolsSelected()) {
      this.setState({ selectedSymbols: new Set() });
    } else {
      this.setState({
        selectedSymbols: new Set(this.props.symbols),
      });
    }
  };

  handleToggleSymbolSelected = (symbol: string) => {
    if (this.isSymbolSelected(symbol)) {
      this.state.selectedSymbols.delete(symbol);
    } else {
      this.state.selectedSymbols.add(symbol);
    }
    this.forceUpdate();
  };

  isAllSymbolsSelected = () => {
    return this.state.selectedSymbols.size === this.props.symbols.length;
  };

  isSymbolSelected = (symbol: string) => {
    return this.state.selectedSymbols.has(symbol);
  };

  render() {
    const tableData = this.props.symbols.map(symbol => {
      const quote = this.props.quotes[symbol];
      const transactions = this.props.transactions.filter(
        transaction => transaction.symbol === symbol
      );

      let costBasis = 0;
      let earnBasis = 0;
      let marketValue = 0;
      let totalShares = 0;

      transactions.forEach(transaction => {
        if (transaction.type.search('Buy') >= 0) {
          costBasis += transaction.price * transaction.shares;
          costBasis += transaction.commission;
          totalShares += transaction.shares;
          if (quote != null) marketValue += quote.latestPrice * transaction.shares;
        }
        else if (transaction.type.search('Sell') >= 0) {
          earnBasis += transaction.price * transaction.shares;
          earnBasis -= transaction.commission;
          totalShares -= transaction.shares;
          if (quote != null) marketValue -= quote.latestPrice * transaction.shares;
        }

        if (!this.state.showClosedPosition && totalShares === 0) {
          costBasis = 0;
          earnBasis = 0;
          marketValue = 0;
        }
      });

      if (totalShares > -0.0001 && totalShares < 0.0001) {
        totalShares = 0;
      }

      if (!this.state.showClosedPosition && totalShares === 0) {
        return null;
      }

      if (totalShares === 0) {
        marketValue = earnBasis;
      } else {
        costBasis -= earnBasis;
      }
      const gain = marketValue - costBasis;

      let gainPercent = 0;
      if (quote != null) gainPercent = gain / costBasis;
      if (totalShares < 0) gainPercent *= -1;

      return {
        change: {
          change: quote == null ? null : quote.change,
          changePercent: quote == null ? null : quote.changePercent,
        },
        companyName: quote == null ? null : quote.companyName,
        costBasis,
        daysGain: quote == null || totalShares === 0 ? null : quote.change * totalShares,
        gain,
        gainPercent,
        latestPrice: quote == null ? null : quote.latestPrice,
        marketValue,
        shares: totalShares,
        symbol,
      };
    });

    const deleteDisabled = this.props.symbols.length === 0 || this.state.selectedSymbols.size === 0;
    return (
      <PortfolioContainer
        deleteDisabled={deleteDisabled}
        showToggleClosedPositionButton={true}
        onToggleClosedPosition={this.handleToggleClosedPosition}
        onDelete={this.handleDeleteSelectedSymbols}>
        <Row className="mb-4">
          <Col>
            <SelectReactTable
              columns={TABLE_COLUMNS}
              data={tableData.filter(Boolean)}
              defaultSorted={[{ desc: false, id: 'symbol' }]}
              getPaginationProps={() => ({
                NextComponent: props => <Button className="btn-sm" outline {...props} />,
                PreviousComponent: props => <Button className="btn-sm" outline {...props} />,
                className: 'pt-2',
                showPageJump: false,
              })}
              minRows={3}
              isSelected={this.isSymbolSelected}
              keyField="symbol"
              noDataText="No symbols yet. Add one using the form below."
              onPageSizeChange={this.handlePageSizeChange}
              pageSize={this.props.appSettings.pageSize}
              selectAll={this.isAllSymbolsSelected()}
              selectType="checkbox"
              toggleAll={this.handleToggleAllSymbols}
              toggleSelection={this.handleToggleSymbolSelected}
            />
          </Col>
        </Row>
      </PortfolioContainer>
    );
  }
}

export default connect<Props, {}, _, _, _, _>(state => ({
  appSettings: state.appSettings,
  quotes: state.quotes,
  symbols: state.symbols,
  transactions: state.transactions,
}))(Performance);
