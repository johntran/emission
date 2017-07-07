import * as React from "react"
import * as Relay from "react-relay"
import styled from "styled-components/native"

import { ListView, ListViewDataSource, RefreshControl, ScrollView, Text, View } from "react-native"
import { LargeHeadline } from "../Typography"

import SwitchBoard from "../../../NativeModules/SwitchBoard"
import ConversationSnippet from "./ConversationSnippet"

const PageSize = 10

const Headline = styled(LargeHeadline)`
  margin-top: 10px;
  margin-bottom: 20px;
`

interface Props extends RelayProps {
  relay: Relay.RelayProp
  headerView?: JSX.Element
  onDataLoaded?: (hasData: boolean) => void
}

interface State {
  dataSource: ListViewDataSource | null
  fetchingNextPage: boolean
  completed: boolean
  initialLoadDone: boolean
}

export class Conversations extends React.Component<Props, State> {
  constructor(props) {
    super(props)

    const dataSource = new ListView.DataSource({
      rowHasChanged: (a, b) => a !== b,
    }).cloneWithRows(this.conversations)

    this.state = {
      dataSource,
      completed: false,
      fetchingNextPage: false,
      initialLoadDone: false,
    }
  }

  componentDidMount() {
    this.setState({
      dataSource: this.state.dataSource,
    })

    if (this.props.onDataLoaded) {
      this.props.onDataLoaded(this.conversations.length > 0)
    }
  }

  componentWillReceiveProps(newProps) {
    const conversations = this.getConversationsFrom(newProps.me)

    this.setState({
      dataSource: this.state.dataSource.cloneWithRows(conversations),
    })
  }

  hasContent() {
    if (!this.props.me) {
      return false
    }

    return this.props.me.conversations.edges.length > 0
  }

  get conversations() {
    return this.getConversationsFrom(this.props.me)
  }

  getConversationsFrom(me) {
    if (!me) {
      return []
    }
    const conversations = me.conversations.edges
      .filter(({ node }) => {
        return node.last_message
      })
      .map(edge => edge.node)
    return conversations || []
  }

  fetchData(nextPage: boolean = true) {
    if (this.state.fetchingNextPage) {
      return
    }
    const totalSize = this.props.relay.variables.totalSize + (nextPage ? PageSize : 0)

    this.setState({ fetchingNextPage: true })
    this.props.relay.forceFetch({ totalSize }, readyState => {
      if (readyState.done) {
        this.setState({
          fetchingNextPage: false,
          dataSource: this.state.dataSource.cloneWithRows(this.conversations),
        })

        if (!this.props.me.conversations.pageInfo.hasNextPage) {
          this.setState({ completed: true, initialLoadDone: true })
        }
      }
    })
  }

  render() {
    return (
      <ListView
        dataSource={this.state.dataSource}
        initialListSize={10}
        scrollEventThrottle={10}
        onEndReachedThreshold={10}
        enableEmptySections={true}
        refreshControl={
          <RefreshControl
            refreshing={this.state.fetchingNextPage && this.state.initialLoadDone}
            onRefresh={() => this.fetchData(false)}
          />
        }
        renderHeader={() => {
          return (
            <View>
              {this.props.headerView}
              {this.hasContent() ? <Headline>Messages</Headline> : null}
            </View>
          )
        }}
        renderRow={data =>
          <ConversationSnippet
            conversation={data}
            key={data.id}
            onSelected={() => SwitchBoard.presentNavigationViewController(this, `conversation/${data.id}`)}
          />}
        onEndReached={() => this.fetchData()}
      />
    )
  }
}

export default Relay.createContainer(Conversations, {
  initialVariables: {
    totalSize: PageSize,
  },
  fragments: {
    me: () => Relay.QL`
      fragment on Me {
        conversations(first: $totalSize) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
              last_message
              ${ConversationSnippet.getFragment("conversation")}
            }
          }
        }
      }
    `,
  },
})

interface RelayProps {
  me: {
    conversations: {
      pageInfo: {
        hasNextPage: boolean
      }
      edges: Array<{
        node: {
          id: string | null
          last_message: string
        } | null
      } | null> | null
    } | null
  }
}
